import React from "react";
import { BuilderPage } from "./BuilderPage.js";
import { PageBuilderField } from "./fields/PageBuilderField.js";

export const pages: Record<string, React.ComponentType> = {
  "/editor": BuilderPage,
};

export const widgets: Record<string, React.ComponentType> = {};

export const fields: Record<string, React.ComponentType> = {
  "page-builder": PageBuilderField,
};
