// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { ExperimentalComposerVoice } from "@get-bb/plugin-sdk/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHoldToTalk } from "./hold-to-talk";

const MIC_RECT = { left: 300, top: 600, width: 40, height: 40 };

function createHandlers() {
  return {
    start: vi.fn<() => void>(),
    stop: vi.fn<() => void>(),
    cancel: vi.fn<() => void>(),
    send: vi.fn<() => void>(),
    fallbackPointerDown:
      vi.fn<(event: ReactPointerEvent<HTMLButtonElement>) => void>(),
    fallbackClick: vi.fn<(event: ReactMouseEvent<HTMLButtonElement>) => void>(),
  };
}

interface HarnessProps {
  voiceState: ExperimentalComposerVoice["state"];
  isPointerCoarse?: boolean;
  handlers: ReturnType<typeof createHandlers>;
}

function Harness({
  voiceState,
  isPointerCoarse = true,
  handlers,
}: HarnessProps) {
  const voice: ExperimentalComposerVoice = {
    state: voiceState,
    delivery: "insert",
    microphoneWarning: null,
    isSupported: true,
    unsupportedMessage: "",
    stream: null,
    failedRecordings: [],
    start: handlers.start,
    stop: handlers.stop,
    cancel: handlers.cancel,
    send: handlers.send,
    retry: () => {},
    discard: () => {},
    download: () => {},
  };
  const holdToTalk = useHoldToTalk({
    voice,
    isPointerCoarse,
    canStartVoiceInput: true,
    startVoiceInput: handlers.start,
    cancelVoiceInput: handlers.cancel,
    onFallbackPointerDown: handlers.fallbackPointerDown,
    onFallbackClick: handlers.fallbackClick,
  });
  return (
    <>
      <button type="button" data-testid="mic" {...holdToTalk.micButtonProps}>
        mic
      </button>
      {holdToTalk.overlay}
    </>
  );
}

function pointerEvent(
  type: string,
  init: { clientX?: number; clientY?: number; button?: number } = {},
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 0,
    clientY: 0,
    ...init,
  });
  return event;
}

function sendTargetCenter(): { clientX: number; clientY: number } {
  const rect = screen.getByText("Send").parentElement!.getBoundingClientRect();
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}

function discardTargetCenter(): { clientX: number; clientY: number } {
  const rect = screen
    .getByText("Discard")
    .parentElement!.getBoundingClientRect();
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}

let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

beforeEach(() => {
  vi.useFakeTimers();
  originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const box =
      this instanceof HTMLElement && this.dataset.testid === "mic"
        ? MIC_RECT
        : {
            left: Number.parseFloat((this as HTMLElement).style?.left || "0"),
            top: Number.parseFloat((this as HTMLElement).style?.top || "0"),
            width: Number.parseFloat((this as HTMLElement).style?.width || "0"),
            height: Number.parseFloat(
              (this as HTMLElement).style?.height || "0",
            ),
          };
    return {
      ...box,
      right: box.left + box.width,
      bottom: box.top + box.height,
      x: box.left,
      y: box.top,
      toJSON: () => box,
    } as DOMRect;
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  cleanup();
  vi.useRealTimers();
});

function holdMic(): void {
  fireEvent(screen.getByTestId("mic"), pointerEvent("pointerdown"));
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useHoldToTalk", () => {
  it("starts recording on press and keeps the transcript in the composer when released on the mic", () => {
    const handlers = createHandlers();
    const { rerender } = render(
      <Harness voiceState="idle" handlers={handlers} />,
    );

    holdMic();
    expect(handlers.start).toHaveBeenCalledTimes(1);

    rerender(<Harness voiceState="recording" handlers={handlers} />);
    advance(1_200);
    fireEvent(window, pointerEvent("pointerup"));

    expect(handlers.stop).toHaveBeenCalledTimes(1);
    expect(handlers.send).not.toHaveBeenCalled();
    expect(handlers.cancel).not.toHaveBeenCalled();
  });

  it("holds the stop back until the recorder has the minimum duration", () => {
    const handlers = createHandlers();
    const { rerender } = render(
      <Harness voiceState="idle" handlers={handlers} />,
    );

    holdMic();
    rerender(<Harness voiceState="recording" handlers={handlers} />);
    advance(400);
    fireEvent(window, pointerEvent("pointerup"));

    expect(handlers.stop).not.toHaveBeenCalled();
    advance(700);
    expect(handlers.stop).toHaveBeenCalledTimes(1);
  });

  it("transcribes and sends when released over the send target", () => {
    const handlers = createHandlers();
    const { rerender } = render(
      <Harness voiceState="idle" handlers={handlers} />,
    );

    holdMic();
    rerender(<Harness voiceState="recording" handlers={handlers} />);
    advance(400);

    const target = sendTargetCenter();
    fireEvent(window, pointerEvent("pointermove", target));
    expect(screen.getByText("Release to send")).toBeTruthy();

    fireEvent(window, pointerEvent("pointerup", target));
    expect(handlers.send).not.toHaveBeenCalled();
    advance(700);

    expect(handlers.send).toHaveBeenCalledTimes(1);
    expect(handlers.stop).not.toHaveBeenCalled();
  });

  it("discards the recording when released over the discard target", () => {
    const handlers = createHandlers();
    const { rerender } = render(
      <Harness voiceState="idle" handlers={handlers} />,
    );

    holdMic();
    rerender(<Harness voiceState="recording" handlers={handlers} />);
    advance(1_200);

    const target = discardTargetCenter();
    fireEvent(window, pointerEvent("pointermove", target));
    expect(screen.getByText("Release to discard")).toBeTruthy();

    fireEvent(window, pointerEvent("pointerup", target));
    rerender(<Harness voiceState="recording" handlers={handlers} />);

    expect(handlers.cancel).toHaveBeenCalledTimes(1);
    expect(handlers.stop).not.toHaveBeenCalled();
    expect(handlers.send).not.toHaveBeenCalled();
  });

  it("discards a recording that only starts after the pointer was released", () => {
    const handlers = createHandlers();
    const { rerender } = render(
      <Harness voiceState="idle" handlers={handlers} />,
    );

    holdMic();
    rerender(<Harness voiceState="recording" handlers={handlers} />);
    advance(1_200);
    const target = discardTargetCenter();
    fireEvent(window, pointerEvent("pointermove", target));

    rerender(<Harness voiceState="idle" handlers={handlers} />);
    fireEvent(window, pointerEvent("pointerup", target));
    expect(handlers.cancel).not.toHaveBeenCalled();

    rerender(<Harness voiceState="recording" handlers={handlers} />);
    expect(handlers.cancel).toHaveBeenCalledTimes(1);
  });

  it("leaves a quick tap recording so tap-to-toggle still works", () => {
    const handlers = createHandlers();
    const { rerender } = render(
      <Harness voiceState="idle" handlers={handlers} />,
    );

    holdMic();
    rerender(<Harness voiceState="recording" handlers={handlers} />);
    advance(80);
    fireEvent(window, pointerEvent("pointerup"));

    expect(handlers.stop).not.toHaveBeenCalled();
    expect(handlers.cancel).not.toHaveBeenCalled();
    expect(screen.queryByText("Send")).toBeNull();

    fireEvent.click(screen.getByTestId("mic"));
    expect(handlers.fallbackClick).not.toHaveBeenCalled();
    expect(handlers.start).toHaveBeenCalledTimes(1);
  });

  it("keeps recording when the pointer is released before the recorder starts", () => {
    const handlers = createHandlers();
    render(<Harness voiceState="idle" handlers={handlers} />);

    holdMic();
    advance(1_200);
    fireEvent(window, pointerEvent("pointerup"));

    expect(handlers.stop).not.toHaveBeenCalled();
    expect(handlers.cancel).not.toHaveBeenCalled();
  });

  it("keeps recording when the browser cancels the pointer mid-hold", () => {
    const handlers = createHandlers();
    const { rerender } = render(
      <Harness voiceState="idle" handlers={handlers} />,
    );

    holdMic();
    rerender(<Harness voiceState="recording" handlers={handlers} />);
    advance(1_200);
    fireEvent(window, pointerEvent("pointercancel"));

    expect(handlers.stop).not.toHaveBeenCalled();
    expect(handlers.cancel).not.toHaveBeenCalled();
  });

  it("leaves fine pointers on the tap-to-toggle path", () => {
    const handlers = createHandlers();
    render(
      <Harness voiceState="idle" isPointerCoarse={false} handlers={handlers} />,
    );

    holdMic();
    expect(handlers.fallbackPointerDown).toHaveBeenCalledTimes(1);
    expect(handlers.start).not.toHaveBeenCalled();

    advance(1_200);
    expect(screen.queryByText("Send")).toBeNull();

    fireEvent.click(screen.getByTestId("mic"));
    expect(handlers.fallbackClick).toHaveBeenCalledTimes(1);
  });
});
