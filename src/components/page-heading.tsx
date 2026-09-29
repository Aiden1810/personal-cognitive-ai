export function PageHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">
        个人决策记录 <span>/ {step}</span>
      </p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
    </div>
  );
}
