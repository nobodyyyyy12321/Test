// 定義 CategoryNode 型別，供全站分類巢狀結構共用
export type CategoryNode = {
  name: string;
  href?: string;
  children?: CategoryNode[];
  dropdown?: { name: string; href: string }[];
};
