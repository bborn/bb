// oxlint-disable bb/no-comments
// FORK-ONLY (bborn/bb): press-and-hold voice input for touch devices.
//
// Upstream the mic is a toggle: tap to record, tap to stop, tap send. Three
// taps for every spoken message. Here, holding the mic records for as long as
// you hold it, and where you let go decides what happens:
//
//   release on the mic   stop, transcribe, leave the text in the composer
//   slide up, release    the same, then send it as soon as the text lands
//   slide left, release  throw the recording away
//
// Slide-up-to-send is the WhatsApp/Telegram slide-onto-a-target idiom, so it
// is already in the fingers of anyone who sends voice notes, and it cannot
// fire by accident: you have to travel a whole button's height off the mic.
// Slide-left-to-cancel is the same convention's escape hatch.
//
// A quick tap (under 250ms) still leaves the recorder running, so upstream's
// tap-to-toggle with the check/X bar is untouched, and so is every fine
// pointer: none of this arms unless the pointer is coarse.
//
// Transcription is a round trip to the server (see useVoiceInput), so the
// text does not exist at release. Slide-to-send therefore arms a pending
// submit and waits for the transcript to reach the composer before firing.
//
// Kept to this one file plus a hook call and two prop spreads in
// PromptBoxInternal.tsx, so the nightly rebase onto upstream has almost
// nothing to merge.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@bb/shared-ui/icon";
import { cn } from "@bb/shared-ui/lib/utils";
import type { PromptVoiceConfig } from "./PromptBoxInternal";

type ForkHoldZone = "compose" | "send" | "cancel";

type ForkHoldPhase = "none" | "tracking" | "held";

interface ForkHoldToTalkOptions {
  voice: PromptVoiceConfig | undefined;
  isPointerCoarse: boolean;
  canStartVoiceInput: boolean;
  canSubmit: boolean;
  startVoiceInput: () => void;
  cancelVoiceInput: () => void;
  submitPrompt: () => void;
  onFallbackPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFallbackClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

export interface ForkHoldToTalkMicButtonProps {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}

export interface ForkHoldToTalk {
  micButtonProps: ForkHoldToTalkMicButtonProps;
  overlay: ReactNode;
}

const TAP_MAX_MS = 250;
const MIN_RECORDING_MS = 1_000;
const TARGET_SLOP_PX = 20;
const PENDING_SEND_TIMEOUT_MS = 8_000;
const PENDING_CANCEL_TIMEOUT_MS = 10_000;
const CLICK_SUPPRESSION_MS = 600;
const TARGET_SIZE_PX = 60;
const TARGET_GAP_PX = 14;
const VIEWPORT_MARGIN_PX = 8;

const MIC_BUTTON_STYLE: CSSProperties = {
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
};

const ZONE_HINT: Record<ForkHoldZone, string> = {
  compose: "Release to put it in the composer",
  send: "Release to send",
  cancel: "Release to discard",
};

function vibrate(durationMs: number): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(durationMs);
  } catch {}
}

function isWithin(
  rect: DOMRect | undefined,
  clientX: number,
  clientY: number,
): boolean {
  if (!rect) return false;
  return (
    clientX >= rect.left - TARGET_SLOP_PX &&
    clientX <= rect.right + TARGET_SLOP_PX &&
    clientY >= rect.top - TARGET_SLOP_PX &&
    clientY <= rect.bottom + TARGET_SLOP_PX
  );
}

export function useForkHoldToTalk(
  options: ForkHoldToTalkOptions,
): ForkHoldToTalk {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const { voice, isPointerCoarse, canStartVoiceInput, canSubmit } = options;
  const voiceState = voice?.state ?? "idle";
  const enabled =
    isPointerCoarse &&
    voice !== undefined &&
    voice.isSupported &&
    canStartVoiceInput;

  const [phase, setPhase] = useState<ForkHoldPhase>("none");
  const [zone, setZone] = useState<ForkHoldZone>("compose");
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [pendingSend, setPendingSend] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);

  const holdPointerIdRef = useRef<number | null>(null);
  const holdStartedAtRef = useRef(0);
  const zoneRef = useRef<ForkHoldZone>("compose");
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const recordingStartedAtRef = useRef<number | null>(null);
  const sendTargetRef = useRef<HTMLDivElement | null>(null);
  const cancelTargetRef = useRef<HTMLDivElement | null>(null);
  const suppressClickUntilRef = useRef(0);
  const heldTimeoutRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (voiceState === "recording") {
      if (recordingStartedAtRef.current === null) {
        recordingStartedAtRef.current = Date.now();
      }
      return;
    }
    recordingStartedAtRef.current = null;
  }, [voiceState]);

  useEffect(
    () => () => {
      if (heldTimeoutRef.current !== null) {
        window.clearTimeout(heldTimeoutRef.current);
      }
      if (stopTimeoutRef.current !== null) {
        window.clearTimeout(stopTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!pendingSend) return;
    if (voiceState === "recording" || voiceState === "transcribing") return;
    if (voiceState === "error") {
      setPendingSend(false);
      return;
    }
    if (canSubmit) {
      setPendingSend(false);
      optionsRef.current.submitPrompt();
      return;
    }
    const timeout = window.setTimeout(() => {
      setPendingSend(false);
    }, PENDING_SEND_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [canSubmit, pendingSend, voiceState]);

  useEffect(() => {
    if (!pendingCancel) return;
    if (voiceState === "recording" || voiceState === "transcribing") {
      setPendingCancel(false);
      optionsRef.current.cancelVoiceInput();
      return;
    }
    const timeout = window.setTimeout(() => {
      setPendingCancel(false);
    }, PENDING_CANCEL_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [pendingCancel, voiceState]);

  const resolveZone = useCallback(
    (clientX: number, clientY: number): ForkHoldZone => {
      if (
        isWithin(
          cancelTargetRef.current?.getBoundingClientRect(),
          clientX,
          clientY,
        )
      ) {
        return "cancel";
      }
      if (
        isWithin(
          sendTargetRef.current?.getBoundingClientRect(),
          clientX,
          clientY,
        )
      ) {
        return "send";
      }
      return "compose";
    },
    [],
  );

  const stopAfterMinimumDuration = useCallback(() => {
    const startedAt = recordingStartedAtRef.current;
    const elapsedMs =
      startedAt === null ? MIN_RECORDING_MS : Date.now() - startedAt;
    const remainingMs = Math.max(0, MIN_RECORDING_MS - elapsedMs);
    if (remainingMs === 0) {
      optionsRef.current.voice?.stop();
      return;
    }
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
    }
    stopTimeoutRef.current = window.setTimeout(() => {
      stopTimeoutRef.current = null;
      optionsRef.current.voice?.stop();
    }, remainingMs);
  }, []);

  const endHold = useCallback(
    (finalZone: ForkHoldZone, interrupted: boolean) => {
      const startedAtMs = holdStartedAtRef.current;
      holdPointerIdRef.current = null;
      if (heldTimeoutRef.current !== null) {
        window.clearTimeout(heldTimeoutRef.current);
        heldTimeoutRef.current = null;
      }
      suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESSION_MS;
      setPhase("none");
      setZone("compose");
      zoneRef.current = "compose";

      if (finalZone === "cancel") {
        vibrate(24);
        setPendingSend(false);
        setPendingCancel(true);
        return;
      }
      if (interrupted) return;
      if (Date.now() - startedAtMs < TAP_MAX_MS) return;
      if (voiceStateRef.current !== "recording") return;

      vibrate(12);
      if (finalZone === "send") {
        setPendingSend(true);
      }
      stopAfterMinimumDuration();
    },
    [stopAfterMinimumDuration],
  );

  useEffect(() => {
    if (phase === "none") return;

    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== holdPointerIdRef.current) return;
      const nextZone = resolveZone(event.clientX, event.clientY);
      if (nextZone === zoneRef.current) return;
      zoneRef.current = nextZone;
      setZone(nextZone);
      vibrate(nextZone === "compose" ? 6 : 14);
    };
    const handleUp = (event: PointerEvent) => {
      if (event.pointerId !== holdPointerIdRef.current) return;
      endHold(resolveZone(event.clientX, event.clientY), false);
    };
    const handleCancel = (event: PointerEvent) => {
      if (event.pointerId !== holdPointerIdRef.current) return;
      endHold("compose", true);
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [endHold, phase, resolveZone]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!enabled) {
        optionsRef.current.onFallbackPointerDown(event);
        return;
      }
      if (event.button !== 0 || holdPointerIdRef.current !== null) return;
      if (
        voiceStateRef.current === "recording" ||
        voiceStateRef.current === "transcribing"
      ) {
        return;
      }
      event.preventDefault();

      const button = event.currentTarget;
      try {
        button.setPointerCapture(event.pointerId);
      } catch {}

      suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESSION_MS;
      holdPointerIdRef.current = event.pointerId;
      holdStartedAtRef.current = Date.now();
      zoneRef.current = "compose";
      setZone("compose");
      setAnchorRect(button.getBoundingClientRect());
      setPhase("tracking");
      if (heldTimeoutRef.current !== null) {
        window.clearTimeout(heldTimeoutRef.current);
      }
      heldTimeoutRef.current = window.setTimeout(() => {
        heldTimeoutRef.current = null;
        if (holdPointerIdRef.current === null) return;
        setPhase("held");
      }, TAP_MAX_MS);

      vibrate(8);
      optionsRef.current.startVoiceInput();
    },
    [enabled],
  );

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (Date.now() < suppressClickUntilRef.current) {
        suppressClickUntilRef.current = 0;
        event.preventDefault();
        return;
      }
      optionsRef.current.onFallbackClick(event);
    },
    [],
  );

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (!enabled) return;
      event.preventDefault();
    },
    [enabled],
  );

  const overlay =
    phase === "held" && anchorRect !== null
      ? createPortal(
          <ForkHoldToTalkTargets
            anchorRect={anchorRect}
            zone={zone}
            sendTargetRef={sendTargetRef}
            cancelTargetRef={cancelTargetRef}
          />,
          document.body,
        )
      : null;

  return {
    micButtonProps: {
      onPointerDown: handlePointerDown,
      onClick: handleClick,
      onContextMenu: handleContextMenu,
      style: enabled ? MIC_BUTTON_STYLE : undefined,
    },
    overlay,
  };
}

function ForkHoldToTalkTargets({
  anchorRect,
  zone,
  sendTargetRef,
  cancelTargetRef,
}: {
  anchorRect: DOMRect;
  zone: ForkHoldZone;
  sendTargetRef: RefObject<HTMLDivElement | null>;
  cancelTargetRef: RefObject<HTMLDivElement | null>;
}) {
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const sendLeft = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(
      anchorCenterX - TARGET_SIZE_PX / 2,
      window.innerWidth - VIEWPORT_MARGIN_PX - TARGET_SIZE_PX,
    ),
  );
  const sendTop = Math.max(
    VIEWPORT_MARGIN_PX,
    anchorRect.top - TARGET_GAP_PX - TARGET_SIZE_PX,
  );
  const cancelLeft = Math.max(
    VIEWPORT_MARGIN_PX,
    anchorRect.left - TARGET_GAP_PX - TARGET_SIZE_PX,
  );
  const cancelTop = anchorRect.top + anchorRect.height / 2 - TARGET_SIZE_PX / 2;

  return (
    <div
      data-fork-hold-to-talk-targets=""
      className="pointer-events-none fixed inset-0 z-50 select-none"
      aria-hidden="true"
    >
      <div
        ref={sendTargetRef}
        style={{
          left: sendLeft,
          top: sendTop,
          width: TARGET_SIZE_PX,
          height: TARGET_SIZE_PX,
        }}
        className={cn(
          "absolute flex flex-col items-center justify-center gap-0.5 rounded-full border shadow-lg transition-[transform,background-color,color] duration-150",
          zone === "send"
            ? "scale-110 border-transparent bg-primary text-primary-foreground"
            : "border-border bg-popover text-muted-foreground",
        )}
      >
        <Icon name="ArrowUp" className="size-5" />
        <span className="text-2xs font-medium leading-none">Send</span>
      </div>
      <div
        ref={cancelTargetRef}
        style={{
          left: cancelLeft,
          top: cancelTop,
          width: TARGET_SIZE_PX,
          height: TARGET_SIZE_PX,
        }}
        className={cn(
          "absolute flex flex-col items-center justify-center gap-0.5 rounded-full border shadow-lg transition-[transform,background-color,color] duration-150",
          zone === "cancel"
            ? "scale-110 border-transparent bg-destructive text-destructive-foreground"
            : "border-border bg-popover text-muted-foreground",
        )}
      >
        <Icon name="X" className="size-5" />
        <span className="text-2xs font-medium leading-none">Discard</span>
      </div>
      <div
        style={{
          top: Math.max(VIEWPORT_MARGIN_PX, sendTop - TARGET_GAP_PX - 28),
        }}
        className="absolute inset-x-0 flex justify-center"
      >
        <span className="rounded-full bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-lg ring-1 ring-border">
          {ZONE_HINT[zone]}
        </span>
      </div>
    </div>
  );
}
