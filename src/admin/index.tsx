import React from "react";
import { BuilderPage } from "./BuilderPage.js";
import { SettingsPage } from "./SettingsPage.js";
import { PageBuilderField } from "./fields/PageBuilderField.js";

export const pages: Record<string, React.ComponentType> = {
  "/editor": BuilderPage,
  "/settings": SettingsPage,
};

export const widgets: Record<string, React.ComponentType> = {};

export const fields: Record<string, React.ComponentType<Record<string, unknown>>> = {
  "page-builder": PageBuilderField as unknown as React.ComponentType<Record<string, unknown>>,
};
