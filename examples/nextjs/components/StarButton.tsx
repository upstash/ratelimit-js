export type StarButtonProps = {
  url?: string;
};

export default function StarButton({ url }: StarButtonProps) {
  if (!url) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex cursor-pointer items-center gap-1.5 rounded bg-white px-4 py-1.5 text-gray-700 hover:bg-primary-50 hover:text-primary-700"
    >
      <svg width="18" height="18" viewBox="0 0 16 16" version="1.1">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"
        />
      </svg>
      <span>Star on GitHub</span>
    </a>
  );
}
