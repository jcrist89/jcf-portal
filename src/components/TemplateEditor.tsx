import { ProgramStructureEditor } from "@/components/ProgramStructureEditor";
import type { Program } from "@/lib/types";

export function TemplateEditor({ program }: { program: Program }) {
  return (
    <ProgramStructureEditor
      program={program}
      backHref="/coach/templates"
      backLabel="← Templates"
      saveLabel="Save Template"
    />
  );
}
