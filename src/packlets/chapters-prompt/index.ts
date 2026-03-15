export function parseVttTime(timeStr: string): number {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatCsvTime(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);

  const mStr = m.toString().padStart(2, "0");
  const sStr = s.toString().padStart(2, "0");

  if (h === 0) {
    return `${m}:${sStr}`;
  }
  return `${h}:${mStr}:${sStr}`;
}

export function vttToCsv(vtt: string): string {
  const cues: Array<{ start: number; text: string }> = [];
  const lines = vtt.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes("-->")) {
      const [startStr] = line.split("-->");
      const start = parseVttTime(startStr.trim());
      const textLines: string[] = [];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].includes("-->")
      ) {
        textLines.push(lines[i].trim());
        i++;
      }
      if (textLines.length > 0) {
        cues.push({ start, text: textLines.join(" ") });
      }
    } else {
      i++;
    }
  }

  const result = cues.map(
    (cue) => `${formatCsvTime(cue.start)},"${cue.text.replace(/"/g, '""')}"`,
  );
  return result.join("\n");
}

export function generateChaptersPrompt(
  transcriptVtt: string,
  videoLanguage: "en" | "th",
): string {
  const transcript = vttToCsv(transcriptVtt);

  return `You will be given a timed transcript of a video or audio recording. Your task is to generate chapters with timestamp information based on this transcript.

Here is the timed transcript:
<transcript>
${transcript}
</transcript>

Analyze the transcript and create meaningful chapters based on the content. Follow these guidelines:

1. Identify major topic changes or significant shifts in the conversation.
2. Create concise, descriptive titles for each chapter that summarize the main point or theme.
3. Use the timestamp of when a new topic or significant point begins as the chapter start time.
4. Aim for chapters that are neither too short (less than 30 seconds) nor too long (more than 5 minutes), unless the content warrants it.

Format your output as follows:
"[timestamp]": "[chapter title]"

For example:
"0:00": "Introduction and greetings"
"2:30": "Discussion of JavaScript projects"

Important notes:
- The first chapter must start at 0:00, regardless of the first timestamp in the transcript.
- Use quotation marks around both the timestamp and the chapter title.
- Use a colon and space after the timestamp.
- Separate each chapter entry with a new line.
- The chapter titles should be in the same language as the transcript.
- Try to summarize the key points in a 'too long; didn't read' manner. We want the viewers to get the gist of the contents just by reading the chapter titles (so they can dive into more details if they're really interested), rather forcing them to read the whole thing to get the point. For example, prefer "when conflicts arise, assume good faith" over "dealing with conflicts".
- Aim for a chapter every 45-120 seconds of transcript.
- Use ${videoLanguage === "en" ? "English" : "Thai"} language.

Think through the transcript carefully, identifying key topics and transitions. Then, create your chapter list based on your analysis.

Provide your final output enclosed in <chapters> tags.`;
}
