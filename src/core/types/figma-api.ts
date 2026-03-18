// ---- Figma REST API response types ----

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaPaint {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: FigmaColor;
  blendMode?: string;
  gradientHandlePositions?: { x: number; y: number }[];
  gradientStops?: { color: FigmaColor; position: number }[];
  scaleMode?: string;
  imageRef?: string;
}

export interface FigmaEffect {
  type: string;
  visible?: boolean;
  radius?: number;
  color?: FigmaColor;
  blendMode?: string;
  offset?: { x: number; y: number };
  spread?: number;
}

export interface FigmaTypeStyle {
  fontFamily?: string;
  fontPostScriptName?: string;
  fontWeight?: number;
  fontSize?: number;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  letterSpacing?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  lineHeightUnit?: string;
  textCase?: string;
  textDecoration?: string;
  italic?: boolean;
}

export interface FigmaLayoutConstraint {
  vertical: string;
  horizontal: string;
}

export interface FigmaRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  // Geometry
  absoluteBoundingBox?: FigmaRectangle;
  absoluteRenderBounds?: FigmaRectangle | null;
  constraints?: FigmaLayoutConstraint;
  size?: { x: number; y: number };
  relativeTransform?: number[][];
  // Style
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  strokeWeight?: number;
  strokeAlign?: string;
  effects?: FigmaEffect[];
  blendMode?: string;
  opacity?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  // Layout
  layoutMode?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  layoutAlign?: string;
  layoutGrow?: number;
  layoutWrap?: string;
  // Text
  characters?: string;
  style?: FigmaTypeStyle;
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<string, FigmaTypeStyle>;
  // Component
  componentId?: string;
  componentSetId?: string;
  componentPropertyDefinitions?: Record<string, unknown>;
  componentProperties?: Record<string, unknown>;
  // Styles
  styles?: Record<string, string>;
  // Export
  exportSettings?: unknown[];
  // Interactions
  interactions?: unknown[];
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
  documentationLinks?: { uri: string }[];
}

export interface FigmaComponentSet {
  key: string;
  name: string;
  description: string;
  documentationLinks?: { uri: string }[];
}

export interface FigmaStyle {
  key: string;
  name: string;
  description: string;
  remote: boolean;
  styleType: string;
}

export interface FigmaFileResponse {
  name: string;
  role: string;
  lastModified: string;
  editorType: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
  components: Record<string, FigmaComponent>;
  componentSets: Record<string, FigmaComponentSet>;
  schemaVersion: number;
  styles: Record<string, FigmaStyle>;
  mainFileKey?: string;
  branches?: { key: string; name: string; thumbnail_url: string }[];
}

export interface FigmaFileNodesResponse {
  name: string;
  role: string;
  lastModified: string;
  thumbnailUrl: string;
  err?: string;
  nodes: Record<string, { document: FigmaNode; components: Record<string, FigmaComponent>; schemaVersion: number; styles: Record<string, FigmaStyle> } | null>;
}

export interface FigmaUserResponse {
  id: string;
  handle: string;
  img_url: string;
  email: string;
}

export interface FigmaComment {
  id: string;
  file_key: string;
  parent_id?: string;
  user: { handle: string; img_url: string; id: string };
  created_at: string;
  resolved_at?: string;
  message: string;
  client_meta?: { x?: number; y?: number; node_id?: string; node_offset?: { x: number; y: number } };
  order_id?: string;
}

export interface FigmaCommentsResponse {
  comments: FigmaComment[];
}

export interface FigmaVersionsResponse {
  versions: {
    id: string;
    created_at: string;
    label: string;
    description: string;
    user: { handle: string; img_url: string; id: string };
  }[];
  pagination: { cursor?: string };
}

export interface FigmaImagesResponse {
  err?: string;
  images: Record<string, string | null>;
}

export interface FigmaStylesResponse {
  status: number;
  error: boolean;
  meta: {
    styles: {
      key: string;
      file_key: string;
      node_id: string;
      style_type: string;
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
      sort_position: string;
    }[];
    cursor?: string;
  };
}

export interface FigmaComponentsResponse {
  status: number;
  error: boolean;
  meta: {
    components: {
      key: string;
      file_key: string;
      node_id: string;
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
    }[];
    cursor?: string;
  };
}

export interface FigmaVariable {
  id: string;
  name: string;
  key: string;
  variableCollectionId: string;
  resolvedType: string;
  description: string;
  hiddenFromPublishing: boolean;
  scopes: string[];
  codeSyntax: Record<string, string>;
  valuesByMode: Record<string, FigmaVariableValue>;
}

export type FigmaVariableValue =
  | boolean
  | number
  | string
  | FigmaColor
  | { type: "VARIABLE_ALIAS"; id: string };

export interface FigmaVariableCollection {
  id: string;
  name: string;
  key: string;
  modes: { modeId: string; name: string }[];
  defaultModeId: string;
  remote: boolean;
  hiddenFromPublishing: boolean;
  variableIds: string[];
}

export interface FigmaLocalVariablesResponse {
  status: number;
  error: boolean;
  meta: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaVariableCollection>;
  };
}

export interface FigmaTeamProjectsResponse {
  name: string;
  projects: { id: string; name: string }[];
}

export interface FigmaProjectFilesResponse {
  name: string;
  files: { key: string; name: string; thumbnail_url: string; last_modified: string }[];
}
