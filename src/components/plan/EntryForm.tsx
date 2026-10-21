import { useId, useState, type FormEvent } from 'react';
import { useT } from '../../i18n';
import {
  PLAN_FLAGS,
  PLAN_KINDS,
  type PlanEntry,
  type PlanEntryInput,
  type PlanFlag,
  type PlanKind,
  type PlanPhase,
  type PlanRef,
  type PlanSection,
} from '../../types/plan';
import type { Platform } from '../../types/steam';
import { EntryPicker } from './EntryPicker';
import { Field } from './Field';

/** Fields of an entry, without section or phase. */
export type EntryFields = Required<Omit<PlanEntryInput, 'section' | 'phaseId'>>;

type Source = 'library' | 'external';

interface EntryFormProps {
  section: PlanSection;
  /** entry being edited (absent = new) */
  entry?: PlanEntry;
  /** plan phases, to move a phase entry being edited */
  phases?: PlanPhase[];
  onSubmit: (fields: EntryFields, phaseId: number | null) => Promise<boolean>;
  onCancel: () => void;
}

/** Sections where the server requires hours and kind. */
function isStrict(section: PlanSection) {
  return section === 'phase' || section === 'recurring';
}

function parseHours(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : Number.NaN;
}

export function EntryForm({ section, entry, phases = [], onSubmit, onCancel }: EntryFormProps) {
  const t = useT('plan');
  const uid = useId();
  const strict = isStrict(section);
  const [source, setSource] = useState<Source>(entry?.external ? 'external' : 'library');
  const [title, setTitle] = useState(entry?.title ?? '');
  const [ref, setRef] = useState<PlanRef | null>(entry?.ref ?? null);
  const [label, setLabel] = useState(entry?.external?.label ?? '');
  const [releaseDate, setReleaseDate] = useState(entry?.external?.releaseDate ?? '');
  const [storeAppid, setStoreAppid] = useState(entry?.external?.storeAppid ?? '');
  const [hours, setHours] = useState(entry?.hours !== null && entry?.hours !== undefined ? String(entry.hours) : strict ? '10' : '');
  const [kind, setKind] = useState<PlanKind>(entry?.kind ?? 'foco');
  const [target, setTarget] = useState(entry?.target !== null && entry?.target !== undefined ? String(entry.target) : '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [flags, setFlags] = useState<PlanFlag[]>(entry?.flags ?? []);
  const [phaseId, setPhaseId] = useState<number | null>(entry?.phaseId ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleFlag(flag: PlanFlag) {
    setFlags((current) => (current.includes(flag) ? current.filter((item) => item !== flag) : [...current, flag]));
  }

  function validate(): EntryFields | string {
    const trimmed = title.trim();
    if (trimmed === '') return t('entryForm.errors.title');
    if (source === 'library' && !ref) return t('entryForm.errors.pickGame');
    if (source === 'external' && label.trim() === '') return t('entryForm.errors.externalLabel');
    if (source === 'external' && storeAppid.trim() !== '' && !/^\d+$/.test(storeAppid.trim())) return t('entryForm.errors.appid');
    const parsedHours = parseHours(hours);
    if (Number.isNaN(parsedHours) || (parsedHours !== null && (parsedHours < 0 || parsedHours > 10000))) return t('entryForm.errors.hours');
    if (strict && parsedHours === null) return t('entryForm.errors.hoursRequired');
    const parsedTarget = target.trim() === '' ? null : Number(target);
    if (parsedTarget !== null && (!Number.isInteger(parsedTarget) || parsedTarget < 0 || parsedTarget > 100)) return t('entryForm.errors.target');
    return {
      title: trimmed,
      ref: source === 'library' ? ref : null,
      external: source === 'external'
        ? {
            label: label.trim(),
            ...(releaseDate !== '' ? { releaseDate } : {}),
            ...(storeAppid.trim() !== '' ? { storeAppid: storeAppid.trim() } : {}),
          }
        : null,
      hours: parsedHours,
      kind: strict ? kind : null,
      target: section === 'phase' ? parsedTarget : null,
      note: note.trim(),
      flags,
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validate();
    if (typeof result === 'string') {
      setProblem(result);
      return;
    }
    setProblem(null);
    setSaving(true);
    const ok = await onSubmit(result, phaseId);
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <form className="pe-form" onSubmit={submit} noValidate>
      <div className="segmented" role="group" aria-label={t('entryForm.sourceAria')}>
        <button type="button" aria-pressed={source === 'library'} onClick={() => setSource('library')}>{t('entryForm.fromLibrary')}</button>
        <button type="button" aria-pressed={source === 'external'} onClick={() => setSource('external')}>{t('entryForm.external')}</button>
      </div>

      {source === 'library' ? (
        <EntryPicker
          selected={ref}
          onPick={(game) => {
            if (!game.platform || !game.platformGameId) return;
            setRef({ platform: game.platform as Platform, id: game.platformGameId });
            setTitle(game.name);
          }}
        />
      ) : (
        <div className="pe-grid">
          <Field label={t('entryForm.where')} htmlFor={`${uid}-label`} hint={t('entryForm.whereHint')}>
            <input id={`${uid}-label`} className="field" value={label} maxLength={200} onChange={(event) => setLabel(event.target.value)} />
          </Field>
          <Field label={t('entryForm.releaseDate')} htmlFor={`${uid}-release`} hint={t('common.optional')}>
            <input id={`${uid}-release`} type="date" className="field" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} />
          </Field>
          <Field label={t('entryForm.appid')} htmlFor={`${uid}-appid`} hint={t('entryForm.appidHint')}>
            <input id={`${uid}-appid`} className="field" inputMode="numeric" value={storeAppid} maxLength={20} onChange={(event) => setStoreAppid(event.target.value)} />
          </Field>
        </div>
      )}

      <Field label={t('common.title')} htmlFor={`${uid}-title`}>
        <input id={`${uid}-title`} className="field" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
      </Field>

      <div className="pe-grid">
        <Field label={t('entryForm.hours')} htmlFor={`${uid}-hours`}>
          <input id={`${uid}-hours`} className="field num" inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} />
        </Field>
        {strict && (
          <Field label={t('entryForm.kind')} htmlFor={`${uid}-kind`}>
            <select id={`${uid}-kind`} className="field" value={kind} onChange={(event) => setKind(event.target.value as PlanKind)}>
              {PLAN_KINDS.map((item) => <option key={item} value={item}>{t(`kind.${item}`)}</option>)}
            </select>
          </Field>
        )}
        {section === 'phase' && (
          <Field label={t('entryForm.target')} htmlFor={`${uid}-target`} hint={t('entryForm.targetHint')}>
            <input id={`${uid}-target`} className="field num" inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value)} />
          </Field>
        )}
        {section === 'phase' && entry && phases.length > 1 && (
          <Field label={t('entryForm.phase')} htmlFor={`${uid}-phase`}>
            <select id={`${uid}-phase`} className="field" value={phaseId ?? ''} onChange={(event) => setPhaseId(Number(event.target.value))}>
              {phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.slug} · {phase.title}</option>)}
            </select>
          </Field>
        )}
      </div>

      <Field label={section === 'phase' || section === 'recurring' ? t('common.note') : t('entryForm.reason')} htmlFor={`${uid}-note`}>
        <textarea id={`${uid}-note`} className="field pe-textarea" rows={2} value={note} maxLength={4000} onChange={(event) => setNote(event.target.value)} />
      </Field>

      <fieldset className="pe-flags">
        <legend className="micro">{t('entryForm.flags')}</legend>
        {PLAN_FLAGS.map((flag) => (
          <label key={flag} className="pe-check">
            <input type="checkbox" checked={flags.includes(flag)} onChange={() => toggleFlag(flag)} />
            {t(`flag.${flag}`)}
          </label>
        ))}
      </fieldset>

      {problem && <p className="pe-error" role="alert">{problem}</p>}
      <div className="pe-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? t('common.saving') : entry ? t('common.save') : t('common.add')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
