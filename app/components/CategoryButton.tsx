import Link from "next/link";
import { CategoryNode } from "./CategoryNode"; // 假設你定義的型別在此

interface CategoryButtonProps {
  subject: { name: string; href: string };
  isOpen: boolean;
  onToggle: () => void;
  subCategories?: Array<{ name: string; href: string }>;
}

export function CategoryButton({ 
  subject, 
  isOpen, 
  onToggle, 
  subCategories 
}: CategoryButtonProps) {
  
  const hasSub = !!subCategories && subCategories.length > 0;

  return (
    <div className="relative flex flex-col items-center">
      {/* 母按鈕：如果有子分類則觸發開關，否則直接跳轉 */}
      {hasSub ? (
        <button
          type="button"
          className={`book-link bookshelf-btn ${isOpen ? 'active-btn' : ''}`}
          onClick={onToggle}
        >
          {subject.name}
        </button>
      ) : (
        <Link
          href={subject.href}
          className="book-link bookshelf-btn"
        >
          {subject.name}
        </Link>
      )}

      {/* 子選單渲染：當 isOpen 為 true 時顯示 */}
      {/* 只展開第一層 children，不遞迴展開 */}
      {isOpen && hasSub && (
        <div className="sub-category-container">
          {subCategories && subCategories.map((sub) => (
            <Link
              key={sub.href}
              href={sub.href}
              className="sub-book-link"
            >
              {sub.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}