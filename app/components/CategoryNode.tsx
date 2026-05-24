// 定義 CategoryNode 型別，供全站分類巢狀結構共用
export type CategoryNode = {
  id?: string;
  name: string;
  href?: string;
  children?: CategoryNode[];
  dropdown?: { id?: string; name: string; href: string }[];
  dropdownAlign?: "left" | "right";
  problemsPerTest?: number | null;   // null/undef = no limit
  shuffleProblems?: boolean | null;  // null/undef = default (ordered); true = shuffle
  approval_status?: string; // Added optional approval_status property
};
