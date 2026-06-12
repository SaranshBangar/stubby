"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  MockRuleRow,
  MockRuleConditionOp,
  MockRuleConditionType,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_LABELS: Record<MockRuleConditionType, string> = {
  query_param: "Query param",
  header: "Header",
  body_field: "Body field",
  method: "Method",
};

const OP_LABELS: Record<MockRuleConditionOp, string> = {
  equals: "equals",
  contains: "contains",
  exists: "exists",
  not_exists: "does not exist",
};

function describeRule(r: MockRuleRow): string {
  const subject =
    r.condition_type === "method"
      ? "method"
      : `${TYPE_LABELS[r.condition_type].toLowerCase()} "${r.condition_key}"`;
  const op = OP_LABELS[r.condition_op];
  const value =
    r.condition_op === "equals" || r.condition_op === "contains"
      ? ` "${r.condition_value}"`
      : "";
  return `if ${subject} ${op}${value}`;
}

export function MockRulesSection({ mockId }: { mockId: string }) {
  const [rules, setRules] = useState<MockRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add-rule form state.
  const [condType, setCondType] = useState<MockRuleConditionType>("query_param");
  const [condKey, setCondKey] = useState("");
  const [condOp, setCondOp] = useState<MockRuleConditionOp>("equals");
  const [condValue, setCondValue] = useState("");
  const [respStatus, setRespStatus] = useState("200");
  const [respBody, setRespBody] = useState('{\n  "ok": true\n}');

  useEffect(() => {
    apiFetch<{ rules: MockRuleRow[] }>(`/api/mocks/${mockId}/rules`)
      .then((d) => setRules(d.rules))
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, [mockId]);

  const needsValue = condOp === "equals" || condOp === "contains";

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { rule } = await apiFetch<{ rule: MockRuleRow }>(
        `/api/mocks/${mockId}/rules`,
        {
          method: "POST",
          body: JSON.stringify({
            condition_type: condType,
            condition_key: condKey.trim(),
            condition_op: condOp,
            condition_value: needsValue ? condValue : undefined,
            response_status: Number(respStatus),
            response_body: respBody,
          }),
        },
      );
      setRules((prev) => [...prev, rule]);
      setCondKey("");
      setCondValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="mt-3 text-xs text-t2">Loading rules…</p>;

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <h4 className="font-mono text-[11px] uppercase tracking-wider text-t3">
        Conditional rules
      </h4>
      <p className="text-xs text-muted-foreground">
        Evaluated in order on every request - first match wins, otherwise the
        default response is served. Rule bodies support template variables.
      </p>

      {rules.length > 0 && (
        <ol className="space-y-2">
          {rules.map((r, i) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"
            >
              <Badge variant="secondary" className="font-mono">
                #{i + 1}
              </Badge>
              <span className="flex-1 truncate font-mono text-xs text-t1">
                {describeRule(r)} → {r.response_status}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  await apiFetch(`/api/mocks/${mockId}/rules/${r.id}`, {
                    method: "DELETE",
                  });
                  setRules((prev) => prev.filter((x) => x.id !== r.id));
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={addRule} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Select
            value={condType}
            onValueChange={(v) => setCondType(v as MockRuleConditionType)}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as MockRuleConditionType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {condType !== "method" && (
            <Input
              placeholder={
                condType === "body_field" ? "user.role" : "name"
              }
              required
              value={condKey}
              onChange={(e) => setCondKey(e.target.value)}
              className="h-8 w-32 font-mono text-xs"
            />
          )}
          <Select
            value={condOp}
            onValueChange={(v) => setCondOp(v as MockRuleConditionOp)}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(OP_LABELS) as MockRuleConditionOp[]).map((o) => (
                <SelectItem key={o} value={o}>
                  {OP_LABELS[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {needsValue && (
            <Input
              placeholder="value"
              required
              value={condValue}
              onChange={(e) => setCondValue(e.target.value)}
              className="h-8 w-32 font-mono text-xs"
            />
          )}
          <Input
            placeholder="status"
            inputMode="numeric"
            required
            value={respStatus}
            onChange={(e) => setRespStatus(e.target.value)}
            className="h-8 w-20 font-mono text-xs"
            aria-label="Response status"
          />
        </div>
        <Textarea
          rows={3}
          spellCheck={false}
          value={respBody}
          onChange={(e) => setRespBody(e.target.value)}
          className="font-mono text-xs text-code"
          aria-label="Rule response body"
        />
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" size="sm" disabled={busy}>
          {busy ? "Adding…" : "+ Add rule"}
        </Button>
      </form>
    </div>
  );
}
