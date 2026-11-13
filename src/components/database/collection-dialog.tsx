"use client";

import { useState, type FormEvent } from "react";
import type {
  CollectionDefinition,
  CollectionSummary,
  FieldDefinition,
  FieldType,
} from "../../../shared/database";
import { databaseApi } from "@/lib/database-api";
import { Dialog } from "./dialog";
import { Icon } from "./icon";

export const fieldTypeLabels: Record<FieldType, string> = {
  text: "Текст",
  textarea: "Длинный текст",
  number: "Число",
  boolean: "Да / нет",
  date: "Дата",
  url: "Ссылка",
};

export function CollectionDialog({
  collection,
  onClose,
  onSaved,
}: {
  collection?: CollectionSummary;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [definition, setDefinition] = useState<CollectionDefinition>(
    collection
      ? {
          name: collection.name,
          label: collection.label,
          description: collection.description,
          fields: collection.fields.map((field) => ({ ...field })),
        }
      : {
          name: "",
          label: "",
          description: "",
          fields: [{ key: "", label: "", type: "text", required: false }],
        },
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const hasData = !!collection?.count;

  function updateField(index: number, update: Partial<FieldDefinition>) {
    setDefinition((current) => ({
      ...current,
      fields: current.fields.map((field, position) =>
        position === index ? { ...field, ...update } : field,
      ),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await databaseApi(
        collection
          ? `/collections/${encodeURIComponent(collection.name)}`
          : "/collections",
        {
          method: collection ? "PUT" : "POST",
          body: JSON.stringify(definition),
        },
      );
      onSaved(definition.name);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить коллекцию.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      wide
      title={collection ? "Настройки коллекции" : "Новая коллекция"}
      subtitle="Опишите поля — форма для заполнения появится автоматически."
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <fieldset className="form-body" disabled={saving}>
          <div className="form-row">
            <label className="form-field">
              Название
              <input
                autoFocus
                required
                maxLength={80}
                placeholder="Например, Товары"
                value={definition.label}
                onChange={(event) =>
                  setDefinition({ ...definition, label: event.target.value })
                }
              />
            </label>
            <label className="form-field">
              Имя в базе
              <input
                required
                disabled={!!collection}
                pattern="[a-z][a-z0-9_]{0,47}"
                placeholder="products"
                value={definition.name}
                onChange={(event) =>
                  setDefinition({ ...definition, name: event.target.value })
                }
              />
              <small>Латиница, цифры и подчёркивание</small>
            </label>
          </div>
          <label className="form-field">
            Описание <span className="optional">необязательно</span>
            <input
              maxLength={400}
              placeholder="Какие данные будут здесь храниться"
              value={definition.description}
              onChange={(event) =>
                setDefinition({
                  ...definition,
                  description: event.target.value,
                })
              }
            />
          </label>
          <div className="form-section-heading">
            <div>
              <h3>Поля формы</h3>
              <p>
                {hasData
                  ? "Можно менять подписи и добавлять необязательные поля. Существующие записи сохранятся."
                  : "Выберите тип каждого поля. Структуру можно дополнить позже."}
              </p>
            </div>
            <span className="count-badge">{definition.fields.length} / 30</span>
          </div>
          <div className="field-list">
            {definition.fields.map((field, index) => {
              const locked =
                hasData && index < (collection?.fields.length ?? 0);
              return (
                <div className="field-builder" key={index}>
                  <span className="field-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <label className="form-field">
                    Подпись
                    <input
                      required
                      maxLength={80}
                      placeholder="Название"
                      value={field.label}
                      onChange={(event) =>
                        updateField(index, { label: event.target.value })
                      }
                    />
                  </label>
                  <label className="form-field">
                    Ключ
                    <input
                      required
                      disabled={locked}
                      pattern="[a-zA-Z][a-zA-Z0-9_]{0,47}"
                      placeholder="title"
                      value={field.key}
                      onChange={(event) =>
                        updateField(index, { key: event.target.value })
                      }
                    />
                  </label>
                  <label className="form-field">
                    Тип
                    <select
                      value={field.type}
                      disabled={locked}
                      onChange={(event) =>
                        updateField(index, {
                          type: event.target.value as FieldType,
                        })
                      }
                    >
                      {Object.entries(fieldTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={field.required}
                      disabled={hasData}
                      onChange={(event) =>
                        updateField(index, { required: event.target.checked })
                      }
                    />
                    Обязательное
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={locked || definition.fields.length === 1}
                    aria-label={`Удалить поле ${index + 1}`}
                    onClick={() =>
                      setDefinition({
                        ...definition,
                        fields: definition.fields.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="button button-subtle add-field"
            disabled={definition.fields.length >= 30}
            onClick={() =>
              setDefinition({
                ...definition,
                fields: [
                  ...definition.fields,
                  { key: "", label: "", type: "text", required: false },
                ],
              })
            }
          >
            <Icon name="plus" size={16} />
            Добавить поле
          </button>
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
            {saving
              ? "Сохранение…"
              : collection
                ? "Сохранить настройки"
                : "Создать коллекцию"}
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
