// Shows a ship's length as a row of hull segments and how many are damaged,
// without implying which specific segment (real board cell) took the hit.
export default function ShipIcon({ size, hitCount, sunk }) {
  const segments = Array.from({ length: size });

  return (
    <div className="shipIcon" aria-hidden="true">
      {segments.map((_, i) => {
        const damaged = sunk || i < hitCount;
        const isBow = i === 0;
        const isStern = i === size - 1;
        let cls = "shipSeg";
        if (damaged) cls += " damaged";
        if (isBow) cls += " bow";
        if (isStern) cls += " stern";
        return <span key={i} className={cls} />;
      })}
    </div>
  );
}
