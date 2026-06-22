interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

const COLORS = [
  "bg-[#EDD9EA] text-[#9B5E82]",
  "bg-[#DBEAFE] text-[#3B82F6]",
  "bg-[#FEF3C7] text-[#B45309]",
  "bg-[#D1FAE5] text-[#047857]",
  "bg-[#FCE7F3] text-[#BE185D]",
  "bg-[#E0E7FF] text-[#4338CA]",
];

function colorForName(name: string) {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-lg",
};

export default function Avatar({ name, size = "md" }: AvatarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${colorForName(name)} ${sizeClasses[size]}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
