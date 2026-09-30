export const PRACTICE_RECORD_NOTICE_TEXT =
  'This is a practice work-sample record. It is not a certified or employer-verified credential.';

export default function PracticeRecordNotice(): React.JSX.Element {
  return (
    <aside className="border-y border-border py-3 text-sm text-muted-foreground">
      {PRACTICE_RECORD_NOTICE_TEXT}
    </aside>
  );
}
