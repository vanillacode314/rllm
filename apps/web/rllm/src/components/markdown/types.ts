import type { Element, ElementContent, Text } from 'hast';
import type { Schema } from 'property-information';
import type { Component, JSX } from 'solid-js';
import type { Position } from 'unist';

/* File for types which are not handled correctly in JSDoc mode */

export type Components = Omit<
  Partial<Omit<NormalComponents, keyof SpecialComponents>> & Partial<SpecialComponents>,
  'text'
> & {
  text?: Component<{
    node: Text;
  }>;
};

export type Context = {
  listDepth: number;
  options: Options;
  schema: Schema;
};
export type NormalComponents = {
  [TagName in keyof JSX.IntrinsicElements]:
    | Component<JSX.IntrinsicElements[TagName] & SolidMarkdownProps>
    | keyof JSX.IntrinsicElements;
};
export type Options = {
  components: Components;
  includeElementIndex: boolean;
  linkTarget: TransformLinkTarget | TransformLinkTargetType;
  rawSourcePos: boolean;
  skipHtml: boolean;
  sourcePos: boolean;
  transformImageUri?: TransformImage;
  transformLinkUri: false | null | TransformLink;
};
export type Raw = {
  type: 'raw';
  value: string;
};
export type SolidMarkdownNames = keyof JSX.IntrinsicElements;
export interface SolidMarkdownProps {
  children: Component[];
  /**
   * Passed when `options.includeElementIndex` is given
   */
  index?: number;
  node: Element;
  /**
   * Passed when `options.includeElementIndex` is given
   */
  siblingCount?: number;
  /**
   * Passed when `options.rawSourcePos` is given
   */
  sourcePosition?: Position;
}
type CodeComponent = Component<
  JSX.IntrinsicElements['code'] & SolidMarkdownProps & { inline?: boolean }
>;
type HeadingComponent = Component<
  JSX.IntrinsicElements['h1'] & SolidMarkdownProps & { level: number }
>;
type LiComponent = Component<
  JSX.IntrinsicElements['li'] &
    SolidMarkdownProps & {
      checked: boolean | null;
      index: number;
      ordered: boolean;
    }
>;
type OrderedListComponent = Component<
  JSX.IntrinsicElements['ol'] & SolidMarkdownProps & { depth: number; ordered: true }
>;
type SpecialComponents = {
  code: CodeComponent | SolidMarkdownNames;
  h1: HeadingComponent | SolidMarkdownNames;
  h2: HeadingComponent | SolidMarkdownNames;
  h3: HeadingComponent | SolidMarkdownNames;
  h4: HeadingComponent | SolidMarkdownNames;
  h5: HeadingComponent | SolidMarkdownNames;
  h6: HeadingComponent | SolidMarkdownNames;
  li: LiComponent | SolidMarkdownNames;
  ol: OrderedListComponent | SolidMarkdownNames;
  td: SolidMarkdownNames | TableCellComponent;
  th: SolidMarkdownNames | TableCellComponent;
  tr: SolidMarkdownNames | TableRowComponent;
  ul: SolidMarkdownNames | UnorderedListComponent;
};
type TableCellComponent = Component<
  JSX.IntrinsicElements['table'] &
    SolidMarkdownProps & { isHeader: boolean; style?: Record<string, unknown> }
>;
type TableRowComponent = Component<
  JSX.IntrinsicElements['tr'] & SolidMarkdownProps & { isHeader: boolean }
>;
type TransformImage = (src: string, alt: string, title?: string) => string;
type TransformLink = (href: string, children: ElementContent[], title?: string) => string;
type TransformLinkTarget = (
  href: string,
  children: ElementContent[],
  title?: string
) => TransformLinkTargetType | undefined;
type TransformLinkTargetType = '_blank' | '_parent' | '_self' | '_top' | (string & {});

type UnorderedListComponent = Component<
  JSX.IntrinsicElements['ul'] & SolidMarkdownProps & { depth: number; ordered: false }
>;
