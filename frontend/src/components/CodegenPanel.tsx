import styles from "./CodegenPanel.module.css";

interface CodegenPanelProps {
  description: string;
  onDescriptionChange: (value: string) => void;
}

export function CodegenPanel({ description, onDescriptionChange }: CodegenPanelProps) {
  return (
    <section className={styles.panel}>
      <span className={styles.eyebrow}>Write a custom strategy</span>
      <p className={styles.explainer}>
        The templates above can only combine three fixed shapes — trend-following, breakout, and mean-reversion —
        with different numbers plugged in. This writes new Python code from your description instead, so it can
        express strategies that don't fit any of those shapes. It's slower: Claude writes the code, it's checked for
        unsafe operations, then it actually runs in an isolated sandbox to confirm it works — up to three attempts if
        something fails along the way.
      </p>
      <textarea
        className={styles.textarea}
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="e.g. “go long when volume is at least twice the 20-day average and the close is in the upper half of the day's range, 2.5% stop, 2R target”"
        rows={2}
      />
    </section>
  );
}
