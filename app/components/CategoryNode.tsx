// 定義 CategoryNode 型別，供全站分類巢狀結構共用
export type CategoryNode = {
  id?: string;
  name: string;
  href?: string;
  children?: CategoryNode[];
  dropdown?: { id?: string; name: string; href: string }[];
  dropdownAlign?: "left" | "right";
};
