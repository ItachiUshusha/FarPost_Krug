"use client";

import { useState, type FormEvent } from "react";
import type {
  CollectionSummary,
  DocumentRecord,
  FieldValue,
} from "../../../shared/database";
import { databaseApi } from "@/lib/database-api";
import { Dialog } from "./dialog";
import { Icon } from "./icon";

export function DocumentDialog({
  collection,
  document,
  onClose,
  onSaved,
}: {
  collection: CollectionSummary;
  document?: DocumentRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(
      collection.fields.map((field) => [
        field.key,
        document?.values[field.key] ?? (field.type === "boolean" ? false : ""),
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const setValue = (key: string, value: FieldValue) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const normalized = Object.fromEntries(
        collection.fields.map((field) => {
          const value = values[field.key];
          return [
            field.key,
            value === ""
              ? null
              : field.type === "number" && value !== null
                ? Number(value)
                : value,
          ];
        }),
      );
      await databaseApi(
        `/collections/${encodeURIComponent(collection.name)}/documents${document ? `/${document.id}` : ""}`,
        {
          method: document ? "PUT" : "POST",
          body: JSON.stringify({ values: normalized }),
        },
      );
      onSaved();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось сохранить запись.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      title={document ? "Редактировать запись" : "Новая запись"}
      subtitle={collection.label}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <fieldset className="form-body document-form" disabled={saving}>
          {collection.fields.map((field, index) => {
            const label = (
              <>
                {field.label}
                {field.required && <span className="required-mark">*</span>}
                <span className="field-key">{field.key}</span>
              </>
            );
            if (field.type === "boolean")
              return (
                <label key={field.key} className="boolean-field">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={!!values[field.key]}
                    onChange={(event) =>
                      setValue(field.key, event.target.checked)
                    }
                  />
                </label>
              );
            if (field.type === "textarea")
              return (
                <label key={field.key} className="form-field">
                  {label}
                  <textarea
                    autoFocus={index === 0}
                    rows={4}
                    required={field.required}
                    maxLength={20_000}
                    value={String(values[field.key] ?? "")}
                    onChange={(event) =>
                      setValue(field.key, event.target.value)
                    }
                  />
                </label>
              );
            return (
              <label key={field.key} className="form-field">
                {label}
                <input
                  autoFocus={index === 0}
                  type={field.type === "text" ? "text" : field.type}
                  step={field.type === "number" ? "any" : undefined}
                  required={field.required}
                  value={String(values[field.key] ?? "")}
                  onChange={(event) => setValue(field.key, event.target.value)}
                />
              </label>
            );
          })}
          <p className="form-hint">
            <Icon name="database" size={14} />
            Идентификатор и даты создаются автоматически.
          </p>
          {error && (
            <div role="alert" className="alert alert-error">
              {error}
            </div>
          )}
        </fieldset>
        <div className="dialog-footer">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить запись"}
            <Icon name="check" size={16} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
