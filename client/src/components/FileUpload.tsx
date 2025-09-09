import React from "react";

type Props = {
  onFile: (file: File) => void;
  label?: string;
};

export default function FileUpload({ onFile, label = "Upload projections CSV" }: Props) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="file"
        accept=".csv"
        className="mt-2 block w-full text-sm"
        data-testid="input-file-upload"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}
