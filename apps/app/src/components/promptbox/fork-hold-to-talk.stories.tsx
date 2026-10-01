// oxlint-disable bb/no-comments
// FORK-ONLY (bborn/bb): a driveable prompt box for the hold-to-talk gesture.
//
// The upstream prompt box stories pass a frozen voice config, which cannot
// show a gesture that spans recording, transcription and submit. This one
// fakes the whole round trip in memory so the gesture can be exercised in a
// real browser at a phone viewport.
import { useCallback, useRef, useState } from "react";
import type { PromptTextMention } from "@bb/domain";
import {
  PromptBoxInternal,
  type PromptBoxHandle,
  type PromptVoiceConfig,
} from "@/components/promptbox/PromptBoxInternal";
import {
  makeAttachmentsConfig,
  makeTypeaheadConfig,
} from "../../../.ladle/story-fixtures";

const TRANSCRIPTION_DELAY_MS = 900;
const FAKE_TRANSCRIPT = "ship the hold to talk patch";

function useFakeVoice(
  appendTranscript: (text: string) => void,
): PromptVoiceConfig {
  const [state, setState] = useState<PromptVoiceConfig["state"]>("idle");
  const timeoutRef = useRef<number | null>(null);

  const start = useCallback(() => {
    setState("recording");
  }, []);

  const stop = useCallback(() => {
    setState("transcribing");
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      appendTranscript(FAKE_TRANSCRIPT);
      setState("idle");
    }, TRANSCRIPTION_DELAY_MS);
  }, [appendTranscript]);

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState("idle");
  }, []);

  return { state, isSupported: true, stream: null, start, stop, cancel };
}

function HoldToTalkStage() {
  const promptBoxRef = useRef<PromptBoxHandle | null>(null);
  const [value, setValue] = useState("");
  const [mentionRanges, setMentionRanges] = useState<PromptTextMention[]>([]);
  const [submitted, setSubmitted] = useState<string[]>([]);

  const appendTranscript = useCallback((text: string) => {
    setValue((current) =>
      current.length > 0 && !/\s$/.test(current)
        ? `${current} ${text}`
        : `${current}${text}`,
    );
  }, []);

  const voice = useFakeVoice(appendTranscript);

  const onSubmit = useCallback(() => {
    setValue((current) => {
      if (current.trim().length > 0) {
        setSubmitted((entries) => [...entries, current.trim()]);
      }
      return "";
    });
    setMentionRanges([]);
  }, []);

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <div
        data-testid="hold-to-talk-sent"
        className="flex flex-1 flex-col justify-end gap-2 overflow-auto p-4"
      >
        {submitted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Hold the mic. Release on it to keep the text, slide up to send,
            slide left to discard.
          </p>
        ) : (
          submitted.map((entry, index) => (
            <p
              key={`${entry}-${index}`}
              className="self-end rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              {entry}
            </p>
          ))
        )}
      </div>
      <div className="p-2">
        <PromptBoxInternal
          promptBoxRef={promptBoxRef}
          value={value}
          mentionRanges={mentionRanges}
          onChange={(nextValue, nextMentions) => {
            setValue(nextValue);
            setMentionRanges(nextMentions);
          }}
          onSubmit={onSubmit}
          placeholder="Ask a follow-up"
          typeahead={makeTypeaheadConfig()}
          mentionMenuPlacement="top"
          attachments={makeAttachmentsConfig()}
          submission={{
            isSubmitting: false,
            disabled: false,
            title: "Submit (Enter)",
          }}
          voice={voice}
        />
      </div>
    </div>
  );
}

export const HoldToTalk = () => <HoldToTalkStage />;
HoldToTalk.storyName = "Hold To Talk";

export default {
  title: "promptbox/Fork Hold To Talk",
};
