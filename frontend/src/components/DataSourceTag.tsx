import { formatLabel } from "../dashboard/formatters";

type DataSourceTagProps = {
  label: string;
  source: string | undefined;
};

export const DataSourceTag = ({ label, source }: DataSourceTagProps) => {
  return <span className="data-source-tag">{label}: {formatLabel(source)}</span>;
};
