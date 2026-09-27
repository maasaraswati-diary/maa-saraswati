import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icons';
import ProductImage from '../../components/ProductImage';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { fetchAboutContent, saveAboutContent, saveProductImage } from '../../store/db';
import { optimiseImage, prettyBytes } from '../../lib/imageOptimiser';
import { DEFAULT_ABOUT, VALUE_ICONS, withAboutDefaults } from '../../aboutContent';

const lines = (text) =>
  String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

const deepCopy = (v) => JSON.parse(JSON.stringify(v));

/**
 * One picture slot: pick a file, see what is there, or put the built-in photo
 * back.
 *
 * The file is compressed in the browser before it is stored, and the reference it
 * gets back is the same "upload:<id>" the catalogue uses, so the About page and a
 * product behave the same way.
 */
function ImageField({ label, value, onChange, onBusy, shape = 'wide' }) {
  const inputId = `img-${label.replace(/\W+/g, '-').toLowerCase()}`;
  // The upload is written under the signed-in account, and firestore.rules only
  // accepts it when ownerEmail matches that account - so the real user has to be
  // passed through rather than a stand-in.
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be chosen again
    if (!file) return;
    setBusy(true);
    onBusy?.(true);
    setMsg(`${file.name} is being compressed…`);
    try {
      // A round avatar crops whatever it is given, so padding a portrait first
      // would only leave a band of white inside the circle and make the person
      // look smaller. Crop to fill instead.
      const shot = await optimiseImage(file, { pad: shape !== 'avatar' });
      setMsg(
        `${file.name} is uploading (${prettyBytes(file.size)} → ${prettyBytes(shot.large.bytes)})`
      );
      const ref = await saveProductImage(shot, user);
      onChange(ref);
      setMsg('');
    } catch (err) {
      // Swallowed here, the owner sees a spinner stop and a slot that never
      // changes, with nothing said. A missing import once made this whole
      // handler fail silently on all five slots, so the reason is now shown in
      // the slot and raised, rather than vanishing into the console.
      setMsg(`Upload failed: ${err?.message || err}`);
      // eslint-disable-next-line no-console
      console.error('[about] image upload failed:', err);
      onBusy?.(false);
      setBusy(false);
      return;
    }
    setBusy(false);
    onBusy?.(false);
  };

  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="img-upload-row" style={{ flexWrap: 'wrap' }}>
        <label className="btn btn-brand btn-sm upload-btn" htmlFor={inputId}>
          <Icon.Upload size={15} />
          {busy ? 'Uploading…' : 'Choose from your computer'}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            onChange={pick}
            disabled={busy}
            hidden
          />
        </label>
        {value && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onChange('')}
          >
            <Icon.Trash size={15} /> Remove
          </button>
        )}
        {msg && <span className="hint">{msg}</span>}
      </div>
      {shape === 'avatar' && (
        <span className="hint">
          Shown as a square photo. A portrait is cropped to fill the frame, so
          put the face in the middle of the picture.
        </span>
      )}
      <div
        style={{
          marginTop: 10,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--line)',
          background: 'var(--sand)',
          // Square for an avatar, so the preview shows the shape the page will
          // use rather than a wide box that crops differently.
          width: shape === 'avatar' ? 132 : undefined,
          maxWidth: shape === 'avatar' ? 132 : 320,
        }}
      >
        {value ? (
          <ProductImage
            src={value}
            alt=""
            loading="lazy"
            preferThumb={shape === 'avatar'}
            sizes={shape === 'avatar' ? '120px' : '320px'}
          />
        ) : (
          <p className="muted" style={{ padding: 18, margin: 0, fontSize: '0.85rem' }}>
            Using the built-in photo. Choose a file to replace it.
          </p>
        )}
      </div>
    </div>
  );
}

/** One repeatable card: promise items, timeline entries, team members. */
function RepeatList({ items, onChange, make, render, addLabel, emptyLabel }) {
  const update = (i, key, value) => {
    const next = [...items];
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div>
      {items.map((item, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className="card form-card" key={i} style={{ marginBottom: 12 }}>
          <div className="admin-card-head">
            <h3 className="h4" style={{ fontSize: '0.95rem' }}>
              {i + 1}
            </h3>
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => remove(i)}
              title="Remove"
            >
              <Icon.Trash size={15} />
            </button>
          </div>
          {render(item, (key, value) => update(i, key, value))}
        </div>
      ))}
      {items.length === 0 && (
        <p className="muted" style={{ padding: 14 }}>{emptyLabel}</p>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => onChange([...items, make(items.length)])}
      >
        <Icon.Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}

const Text = ({ label, value, onChange, textarea, rows, hint, placeholder }) => (
  <div className="field">
    <label className="label" htmlFor={`f-${label.replace(/\W+/g, '-')}`}>
      {label}
    </label>
    {textarea ? (
      <textarea
        id={`f-${label.replace(/\W+/g, '-')}`}
        className="textarea"
        style={rows ? { minHeight: rows * 22 } : undefined}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    ) : (
      <input
        id={`f-${label.replace(/\W+/g, '-')}`}
        className="input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )}
    {hint && <span className="hint">{hint}</span>}
  </div>
);

/**
 * The About page editor.
 *
 * Everything the public page shows is editable here, and saving writes the whole
 * document, so what is on screen is what the site shows. Nothing has to be saved
 * for the page to work - an empty collection leaves the built-in copy in place -
 * which is what makes "Restore the original text" a safe thing to offer.
 */
export default function PartnerAboutContent() {
  const toast = useToast();
  const { user } = useAuth();
  // The paragraphs are edited in one textarea but stored as a list, so the text
  // is seeded from the list. Doing it here rather than at render time matters:
  // the list is an array, and running an array through lines() would join it
  // with commas.
  const [form, setForm] = useState(() => {
    const seed = deepCopy(DEFAULT_ABOUT);
    seed.story.paragraphsText = seed.story.paragraphs.join('\n\n');
    return seed;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchAboutContent()
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          // withAboutDefaults rather than a raw spread: the stored document also
          // carries bookkeeping fields (kind, updatedAt) that have no business
          // in a form that gets written straight back out.
          const next = deepCopy(withAboutDefaults(saved));
          next.story.paragraphsText = next.story.paragraphs.join('\n\n');
          setForm(next);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!cancelled) toast.error(e?.message || 'Could not load the About page.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback((section, field) => (value) => {
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
  }, []);

  const setList = useCallback((section, field) => (value) => {
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
  }, []);

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      // Textareas are edited as one block; the page wants them as a list.
      const payload = deepCopy(form);
      payload.story.paragraphs = lines(payload.story.paragraphsText);
      delete payload.story.paragraphsText;

      const missing = [
        ['header title', payload.header.titleLead],
        ['story title', payload.story.title],
      ].filter(([, v]) => !String(v || '').trim());
      if (missing.length) {
        toast.error(`Please fill in: ${missing.map((m) => m[0]).join(', ')}.`);
        setSaving(false);
        return;
      }

      await saveAboutContent(payload, user);
      toast.success('About page updated — it is live on the website now.');
      setLoaded(true);
    } catch (err) {
      toast.error(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const restore = () => {
    if (
      !window.confirm(
        'Put the built-in text back? Anything you have written here will be lost.'
      )
    ) {
      return;
    }
    const fresh = deepCopy(DEFAULT_ABOUT);
    fresh.story.paragraphsText = fresh.story.paragraphs.join('\n\n');
    setForm(fresh);
    toast.info('Original text loaded. Press Save to put it live.');
  };

  if (loading) {
    return <p className="muted" style={{ padding: 20 }}>Loading…</p>;
  }

  return (
    <form onSubmit={save}>
      {/* ---------- header ---------- */}
      <div className="card form-card">
        <div className="admin-card-head">
          <h2 className="h3">
            <Icon.Sparkle size={19} /> Page heading
          </h2>
        </div>
        <div className="form-row">
          <Text label="Small label above the title" value={form.header.eyebrow}
            onChange={set('header', 'eyebrow')} />
          <Text label="Title — first part" value={form.header.titleLead}
            onChange={set('header', 'titleLead')} />
        </div>
        <Text label="Title — highlighted part" value={form.header.titleHighlight}
          onChange={set('header', 'titleHighlight')}
          hint="Shown in the italic green style." />
        <Text label="Subtitle" textarea value={form.header.subtitle}
          onChange={set('header', 'subtitle')} />
      </div>

      {/* ---------- story ---------- */}
      <div className="card form-card">
        <div className="admin-card-head">
          <h2 className="h3">
            <Icon.Star size={19} /> Our Story
          </h2>
        </div>
        <ImageField
          label="Story photograph"
          value={form.story.image}
          onChange={set('story', 'image')}
          onBusy={setUploading}
        />
        <div className="form-row">
          <Text label="Small label" value={form.story.eyebrow}
            onChange={set('story', 'eyebrow')} />
          <Text label="Heading" value={form.story.title}
            onChange={set('story', 'title')} />
        </div>
        <div className="form-row">
          <Text label="Badge — number" value={form.story.badgeValue}
            onChange={set('story', 'badgeValue')} />
          <Text label="Badge — words under it" value={form.story.badgeLabel}
            onChange={set('story', 'badgeLabel')} />
        </div>
        <Text
          label="Paragraphs"
          textarea
          value={form.story.paragraphsText || ''}
          onChange={set('story', 'paragraphsText')}
          hint="Leave a blank line between paragraphs."
          rows={8}
        />
      </div>

      {/* ---------- promise ---------- */}
      <div className="card form-card">
        <div className="admin-card-head">
          <h2 className="h3">
            <Icon.Shield size={19} /> Our Promise
          </h2>
        </div>
        <div className="form-row">
          <Text label="Small label" value={form.promise.eyebrow}
            onChange={set('promise', 'eyebrow')} />
          <Text label="Heading" value={form.promise.title}
            onChange={set('promise', 'title')} />
        </div>
        <RepeatList
          items={form.promise.items}
          onChange={setList('promise', 'items')}
          make={() => ({ icon: 'Drop', title: '', text: '' })}
          addLabel="Add a promise"
          emptyLabel="No promises yet."
          render={(item, setItem) => (
            <>
              <div className="form-row">
                <div className="field">
                  <label className="label">Icon</label>
                  <select
                    className="input"
                    value={item.icon}
                    onChange={(e) => setItem('icon', e.target.value)}
                  >
                    {VALUE_ICONS.map((ic) => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </div>
                <Text label="Title" value={item.title}
                  onChange={(v) => setItem('title', v)} />
              </div>
              <Text label="Text" textarea value={item.text}
                onChange={(v) => setItem('text', v)} />
            </>
          )}
        />
      </div>

      {/* ---------- timeline ---------- */}
      <div className="card form-card">
        <div className="admin-card-head">
          <h2 className="h3">
            <Icon.Tag size={19} /> Milestones
          </h2>
        </div>
        <div className="form-row">
          <Text label="Small label" value={form.timeline.eyebrow}
            onChange={set('timeline', 'eyebrow')} />
          <Text label="Heading" value={form.timeline.title}
            onChange={set('timeline', 'title')} />
        </div>
        <RepeatList
          items={form.timeline.items}
          onChange={setList('timeline', 'items')}
          make={() => ({ year: '', title: '', text: '' })}
          addLabel="Add a milestone"
          emptyLabel="No milestones yet."
          render={(item, setItem) => (
            <>
              <Text label="Year" value={item.year}
                onChange={(v) => setItem('year', v)} placeholder="2024" />
              <Text label="Title" value={item.title}
                onChange={(v) => setItem('title', v)} />
              <Text label="Text" textarea value={item.text}
                onChange={(v) => setItem('text', v)} />
            </>
          )}
        />
      </div>

      {/* ---------- team ---------- */}
      <div className="card form-card">
        <div className="admin-card-head">
          <h2 className="h3">
            <Icon.Family size={19} /> The People
          </h2>
        </div>
        <div className="form-row">
          <Text label="Small label" value={form.team.eyebrow}
            onChange={set('team', 'eyebrow')} />
          <Text label="Heading" value={form.team.title}
            onChange={set('team', 'title')} />
        </div>
        <RepeatList
          items={form.team.members}
          onChange={setList('team', 'members')}
          make={() => ({ name: '', role: '', text: '', image: '' })}
          addLabel="Add a person"
          emptyLabel="Nobody listed yet."
          render={(m, setItem) => (
            <>
              <ImageField
                label={`Photograph — ${m.name || 'new person'}`}
                value={m.image}
                onChange={(v) => setItem('image', v)}
                onBusy={setUploading}
                shape="avatar"
              />
              <div className="form-row">
                <Text label="Name" value={m.name}
                  onChange={(v) => setItem('name', v)} />
                <Text label="Role" value={m.role}
                  onChange={(v) => setItem('role', v)} />
              </div>
              <Text label="What they do" textarea value={m.text}
                onChange={(v) => setItem('text', v)} />
            </>
          )}
        />
      </div>

      {/* ---------- facility ---------- */}
      <div className="card form-card">
        <div className="admin-card-head">
          <h2 className="h3">
            <Icon.MapPin size={19} /> The Plant
          </h2>
        </div>
        <ImageField
          label="Plant photograph"
          value={form.facility.image}
          onChange={set('facility', 'image')}
          onBusy={setUploading}
        />
        <div className="form-row">
          <Text label="Small label" value={form.facility.eyebrow}
            onChange={set('facility', 'eyebrow')} />
          <Text label="Heading" value={form.facility.title}
            onChange={set('facility', 'title')} />
        </div>
        <Text label="Text" textarea value={form.facility.text}
          onChange={set('facility', 'text')} />
        <Text
          label="Checklist — one per line"
          textarea
          value={(form.facility.points || []).join('\n')}
          onChange={(v) => setList('facility', 'points')(lines(v))}
          rows={4}
        />
      </div>

      <div
        className="card form-card"
        style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <button
          type="submit"
          className="btn btn-brand"
          disabled={saving || uploading}
        >
          <Icon.Check size={17} />
          {saving ? 'Saving…' : uploading ? 'Waiting for the photo…' : 'Save and publish'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={restore} disabled={saving}>
          <Icon.Refresh size={16} /> Restore the original text
        </button>
        <a
          className="btn btn-ghost"
          href="/about"
          target="_blank"
          rel="noreferrer"
        >
          <Icon.Globe size={16} /> See the live page
        </a>
        <span className="hint" style={{ marginLeft: 'auto' }}>
          Changes appear on the website as soon as you save.
        </span>
      </div>
    </form>
  );
}
