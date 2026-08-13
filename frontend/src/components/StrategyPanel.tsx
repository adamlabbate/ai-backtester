import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { fetchTemplates, interpretStrategy } from "../api";
import type { TemplateInfo } from "../types";
import styles from "./StrategyPanel.module.css";

export interface StrategyState {
  template: string;
  params: Record<string, number>;
}

interface StrategyPanelProps {
  strategy: StrategyState;
  onStrategyChange: (strategy: StrategyState) => void;
}

function defaultParams(template: TemplateInfo): Record<string, number> {
  const params: Record<string, number> = {};
  for (const param of template.params) {
    params[param.name] = param.default ?? 0;
  }
  return params;
}

export function StrategyPanel({ strategy, onStrategyChange }: StrategyPanelProps) {
  // Templates load once from the backend's registry (see
  // backend/ai/templates.py via GET /api/templates) so this component never
  // hardcodes a template's shape -- add a template on the backend and it
  // shows up here automatically.
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [description, setDescription] = useState("");
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch(() => setInterpretError("Couldn't load strategy templates from the backend."));
  }, []);

  const activeTemplate = templates.find((t) => t.id === strategy.template);

  async function handleInterpret(event: FormEvent) {
    event.preventDefault();
    if (!description.trim()) return;

    setInterpreting(true);
    setInterpretError(null);
    try {
      const result = await interpretStrategy(description);
      const matched = templates.find((t) => t.id === result.template);
      // Claude only returns params it chose to override -- layer them over
      // that template's schema defaults so every param has a value, not
      // just the ones Claude mentioned.
      const params = matched ? { ...defaultParams(matched), ...result.params } : result.params;
      onStrategyChange({ template: result.template, params });
      setReasoning(result.reasoning);
    } catch (err) {
      setInterpretError(err instanceof Error ? err.message : "Couldn't interpret that description.");
    } finally {
      setInterpreting(false);
    }
  }

  function handleTemplateSelect(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    onStrategyChange({ template: templateId, params: defaultParams(template) });
    setReasoning(null); // manual pick supersedes any prior AI explanation
  }

  function handleParamChange(name: string, rawValue: string) {
    const value = rawValue === "" ? 0 : Number(rawValue);
    if (Number.isNaN(value)) return;
    onStrategyChange({ template: strategy.template, params: { ...strategy.params, [name]: value } });
  }

  return (
    <section className={styles.panel}>
      <form className={styles.chatRow} onSubmit={handleInterpret}>
        <label className={styles.chatField}>
          <span className={styles.eyebrow}>Describe a strategy</span>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. “buy a 20-day breakout with a tight 1% stop” or “fade dips 2 standard deviations below the 20-day average”"
            rows={2}
          />
        </label>
        <button className={styles.interpretButton} type="submit" disabled={interpreting || !description.trim()}>
          {interpreting ? "Interpreting…" : "Interpret strategy"}
        </button>
      </form>

      {interpretError && (
        <p className={styles.error} role="alert">
          {interpretError}
        </p>
      )}

      {reasoning && (
        <p className={styles.reasoning}>
          <span className={styles.reasoningLabel}>Claude:</span> {reasoning}
        </p>
      )}

      <div className={styles.divider} />

      <div className={styles.manualRow}>
        <label className={styles.field}>
          <span className={styles.eyebrow}>Template</span>
          <select
            className={styles.select}
            value={strategy.template}
            onChange={(e) => handleTemplateSelect(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {activeTemplate?.params.map((param) => (
          <label className={styles.field} key={param.name} title={param.description}>
            <span className={styles.eyebrow}>{param.name}</span>
            <input
              className={styles.paramInput}
              type="number"
              step={param.type === "integer" ? 1 : 0.01}
              value={strategy.params[param.name] ?? param.default ?? 0}
              onChange={(e) => handleParamChange(param.name, e.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
