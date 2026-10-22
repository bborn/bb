import "../../../.ladle/composer-plugin";
import { useCallback, useRef, useState } from "react";
import type { PromptTextMention } from "@bb/domain";
import {
  ComposerBox,
  type PromptVoiceConfig,
} from "@/components/promptbox/ComposerBox";
import {
  makeAttachmentsConfig,
  makeTypeaheadConfig,
} from "../../../.ladle/story-fixtures";

const TRANSCRIPTION_DELAY_MS = 900;
const FAKE_TRANSCRIPT = "ship the hold to talk patch";

function useFakeVoice(
  appendTranscript: (text: string) => void,
  submit: () => void,
): PromptVoiceConfig {
  const [state, setState] = useState<PromptVoiceConfig["state"]>("idle");
  const timeoutRef = useRef<number | null>(null);

  const start = useCallback(() => {
    setState("recording");
  }, []);

  const finish = useCallback(
    (send: boolean) => {
      setState("transcribing");
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        appendTranscript(FAKE_TRANSCRIPT);
        setState("idle");
        if (send) window.setTimeout(submit, 0);
      }, TRANSCRIPTION_DELAY_MS);
    },
    [appendTranscript, submit],
  );
  const stop = useCallback(() => finish(false), [finish]);
  const send = useCallback(() => finish(true), [finish]);

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState("idle");
  }, []);

  return {
    state,
    delivery: "insert",
    microphoneWarning: null,
    isSupported: true,
    stream: null,
    failedRecordings: [],
    start,
    stop,
    send,
    retry: () => {},
    discard: () => {},
    download: () => {},
    cancel,
  };
}

function HoldToTalkStage() {
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

  const onSubmit = useCallback(() => {
    setValue((current) => {
      if (current.trim().length > 0) {
        setSubmitted((entries) => [...entries, current.trim()]);
      }
      return "";
    });
    setMentionRanges([]);
  }, []);

  const voice = useFakeVoice(appendTranscript, onSubmit);

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
        <ComposerBox
          surface="thread"
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
  title: "promptbox/Hold To Talk",
};
