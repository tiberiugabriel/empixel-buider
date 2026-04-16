import React from "react";
import type { FieldDef } from "../blockDefinitions.js";
import { JsonArrayField } from "./JsonArrayField.js";

interface Props {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function FieldRenderer({ field, value, onChange }: Props) {
  if (field.type === "json-array") {
    return (
      <JsonArrayField
        field={field}
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
      />
    );
  }

  if (field.type === "toggle") {
    return (
      <div className="epx-field epx-field--toggle">
        <label className="epx-field__toggle-label">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="epx-field__toggle-input"
          />
          <span className="epx-field__label">{field.label}</span>
        </label>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="epx-field">
        <label className="epx-field__label">{field.label}</label>
        <select
          className="epx-field__select"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Select —</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="epx-field">
        <label className="epx-field__label">{field.label}</label>
        <textarea
          className="epx-field__textarea"
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="epx-field">
        <label className="epx-field__label">{field.label}</label>
        <input
          type="number"
          className="epx-field__input"
          value={typeof value === "number" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    );
  }

  // text + url
  return (
    <div className="epx-field">
      <label className="epx-field__label">
        {field.label}
        {field.required && <span className="epx-field__required">*</span>}
      </label>
      <input
        type={field.type === "url" ? "url" : "text"}
        className="epx-field__input"
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
