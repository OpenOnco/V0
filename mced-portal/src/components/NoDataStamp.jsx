export default function NoDataStamp() {
  return (
    <div
      className="absolute top-1/2 left-1/2 text-[13px] font-medium text-red-500 uppercase tracking-wide whitespace-nowrap pointer-events-none border-2 border-red-500 px-4 py-1.5 rounded-md"
      style={{
        transform: 'translate(-50%, -50%) rotate(-18deg)',
        opacity: 0.55,
      }}
    >
      No early stage per cancer data published
    </div>
  );
}
