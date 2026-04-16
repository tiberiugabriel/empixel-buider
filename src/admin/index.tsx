import React from "react";
import { BuilderPage } from "./BuilderPage.js";

export const pages: Record<string, React.ComponentType> = {
  editor: BuilderPage,
};

export const widgets: Record<string, React.ComponentType> = {};

export const fields: Record<string, React.ComponentType> = {};
