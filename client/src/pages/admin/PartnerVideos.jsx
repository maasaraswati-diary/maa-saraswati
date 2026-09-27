import { useRef, useState } from 'react';
import Icon from '../../components/Icons';
import Picture from '../../components/Picture';
import { useToast } from '../../components/Toast';
import { useFetch } from '../../hooks';
import {
  checkFile,
  deleteVideo,
  fetchVideoList,
  reorderVideos,
  updateVideo,
  uploadVideo,
} from '../../store/videos';
import { fileSize, makePosterFrame } from '../../lib/videoPoster';

/** When a film went up, in a form worth reading. */
function addedWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The video page, as the owner sees it.
 *
 * Films are stored in Cloudflare R2 rather than in the database, for one plain
 * reason: a film is measured in megabytes and the database's documents are
 * capped at one. R2's free tier holds 10 GB and, unlike the hosting plan this
 * site left behind, it does not charge for the data coming back out - which is
 * what a film is: something every visitor who presses play downloads in full.
 *
 * The poster frame is grabbed from the film in the browser as it is chosen, so
 * the picture on the page always belongs to the film above it and no separate
 * image has to be picked or kept in step by hand.
 */
export default function PartnerVideos() {
  const toast = useToast();
  const fileRef = useRef(null);

  const list = useFetch(() => fetchVideoList(), []);
  const videos = list.data?.videos || [];
  const storageOn = list.data?.available !== false;

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState(''); // what the upload is doing right now
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // the film being renamed
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [confirm, setConfirm] = useState(null);

  const choose = (e) => {
    const picked = e.target.files?.[0] || null;
    e.target.value = ''; // the same file can be chosen again
    if (!picked) return;
    const why = checkFile(picked);
    if (why) {
      setFile(null);
      setProblem(why);
      return;
    }
    setFile(picked);
    setProblem('');
    // A title is a nuisance to type when the file already says what it is, so
    // one is offered - it can be changed before anything is sent.
    if (!title) {
      setTitle(
        picked.name
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 80)
      );
    }
  };

  const send = async () => {
    if (!file) {
      setProblem('Please choose a video file first.');
      return;
    }
    if (!title.trim()) {
      setProblem('Please give the film a title.');
      return;
    }

    setBusy(true);
    setProblem('');
    try {
      setStage('Reading a frame from the film…');
      const poster = await makePosterFrame(file);
      setStage(`Uploading ${fileSize(file.size)}…`);
      const res = await uploadVideo({ file, title: title.trim(), note: note.trim(), poster });
      toast.success(`"${res.video.title}" is now on the video page.`);
      setFile(null);
      setTitle('');
      setNote('');
      setStage('');
      list.reload();
    } catch (err) {
      setStage('');
      setProblem(err?.message || 'The upload did not finish. Please try again.');
    }
    setBusy(false);
  };

  const startEdit = (v) => {
    setPending(v.slug);
    setEditTitle(v.title);
    setEditNote(v.note || '');
    setProblem('');
  };

  const saveEdit = async (key) => {
    if (!editTitle.trim()) {
      setProblem('A film needs a title.');
      return;
    }
    setBusy(true);
    try {
      await updateVideo(key, { title: editTitle.trim(), note: editNote.trim() });
      toast.success('Saved.');
      setPending(null);
      list.reload();
    } catch (err) {
      setProblem(err?.message || 'Could not save that change.');
    }
    setBusy(false);
  };

  const move = async (index, by) => {
    const next = videos.slice();
    const to = index + by;
    if (to < 0 || to >= next.length) return;
    const [film] = next.splice(index, 1);
    next.splice(to, 0, film);
    setBusy(true);
    try {
      await reorderVideos(next.map((v) => v.slug));
      list.reload();
      toast.success('The order is saved.');
    } catch (err) {
      toast.error(err?.message || 'Could not change the order.');
    }
    setBusy(false);
  };

  const remove = async (key) => {
    setBusy(true);
    try {
      const res = await deleteVideo(key);
      setConfirm(null);
      list.reload();
      toast.success(`Removed. ${res.total} film${res.total === 1 ? '' : 's'} left.`);
    } catch (err) {
      setProblem(err?.message || 'Could not remove that film.');
    }
    setBusy(false);
  };

  if (list.error) {
    return (
      <div className="error-state">
        <span className="error-icon">
          <Icon.Alert size={28} />
        </span>
        <h3 className="h3">Could not reach the video service</h3>
        <p className="muted">
          Nothing has been lost. The films on the website are untouched — this is a connection
          problem. Check your internet and try again.
        </p>
        <button type="button" className="btn btn-brand btn-sm" onClick={list.reload}>
          <Icon.Refresh size={15} /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="vid-panel">
      <div className="admin-head">
        <div>
          <h3 className="h3">Videos</h3>
          <p className="muted">
            Upload a film and it appears on the website's video page straight away. There is no
            limit on how many people watch — that is the whole reason the films live on Cloudflare
            rather than on the old host.
          </p>
        </div>
        <span className="badge badge-brand">
          {storageOn ? 'Storage on' : 'Storage not switched on'}
        </span>
      </div>

      {!storageOn && (
        <div className="notice notice-warn">
          <Icon.Alert size={18} />
          <div>
            <strong>Films cannot be uploaded yet.</strong> Cloudflare's R2 storage has to be
            switched on in the Cloudflare dashboard first. The website is still showing the films it
            was built with, so nothing is broken in the meantime.
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ add a film */}
      <section className="card form-card">
        <h4 className="h4">
          <Icon.Plus size={17} /> Add a video
        </h4>

        <div className="field">
          <span className="label">Video file</span>
          <label className="drop-zone" htmlFor="video-file">
            <Icon.Upload size={20} />
            {file ? (
              <>
                <strong>{file.name}</strong>
                <span className="hint">
                  {fileSize(file.size)} · a poster frame will be taken from it automatically
                </span>
              </>
            ) : (
              <>
                <strong>Choose a video from your computer</strong>
                <span className="hint">MP4 or WebM, up to 25 MB</span>
              </>
            )}
            <input
              id="video-file"
              ref={fileRef}
              type="file"
              accept="video/mp4,video/webm,.mp4,.webm"
              onChange={choose}
              disabled={busy}
              hidden
            />
          </label>
          {file && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setFile(null)}
              disabled={busy}
            >
              <Icon.X size={14} /> Choose a different file
            </button>
          )}
        </div>

        <div className="field">
          <span className="label" htmlFor="video-title">
            Title
          </span>
          <input
            id="video-title"
            className="input"
            value={title}
            maxLength={80}
            placeholder="Our fresh paneer, straight from the plant"
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="field">
          <span className="label" htmlFor="video-note">
            One line about it <span className="muted">(optional)</span>
          </span>
          <input
            id="video-note"
            className="input"
            value={note}
            maxLength={200}
            placeholder="Set from our own milk. No starch, no vegetable fat."
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
          />
        </div>

        {stage && <p className="hint">{stage}</p>}
        {problem && (
          <p className="form-error" role="alert">
            <Icon.Alert size={15} /> {problem}
          </p>
        )}

        <button
          type="button"
          className="btn btn-brand"
          onClick={send}
          disabled={busy || !file || !storageOn}
        >
          {busy ? 'Working…' : <><Icon.Upload size={16} /> Put it on the website</>}
        </button>
      </section>

      {/* ------------------------------------------------------ what is up */}
      <section className="card form-card">
        <h4 className="h4">
          <Icon.Play size={17} /> On the website now
        </h4>

        {list.loading ? (
          <p className="muted">Loading…</p>
        ) : videos.length === 0 ? (
          <p className="muted">
            Nothing uploaded yet. The website is still showing the films it was built with — the
            first film you upload takes over from there.
          </p>
        ) : (
          <ul className="vid-list">
            {videos.map((v, i) => (
              <li className="vid-row" key={v.slug}>
                <div className="vid-thumb">
                  {v.poster ? (
                    <Picture
                      src={v.poster}
                      alt=""
                      single
                      width={96}
                      height={54}
                      loading="lazy"
                    />
                  ) : (
                    <span className="vid-thumb-blank">
                      <Icon.Play size={18} />
                    </span>
                  )}
                </div>

                <div className="vid-main">
                  {pending === v.slug ? (
                    <>
                      <input
                        className="input"
                        value={editTitle}
                        maxLength={80}
                        onChange={(e) => setEditTitle(e.target.value)}
                        disabled={busy}
                        aria-label="Title"
                      />
                      <input
                        className="input"
                        value={editNote}
                        maxLength={200}
                        placeholder="One line about it (optional)"
                        onChange={(e) => setEditNote(e.target.value)}
                        disabled={busy}
                        aria-label="Note"
                      />
                      <div className="vid-actions">
                        <button
                          type="button"
                          className="btn btn-brand btn-sm"
                          onClick={() => saveEdit(v.slug)}
                          disabled={busy}
                        >
                          <Icon.Check size={15} /> Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPending(null)}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong className="vid-title">{v.title}</strong>
                      {v.note && <span className="vid-note">{v.note}</span>}
                      <span className="hint">
                        {fileSize(v.size)}
                        {addedWhen(v.added) ? ` · added ${addedWhen(v.added)}` : ''}
                      </span>
                    </>
                  )}
                </div>

                {pending !== v.slug && (
                  <div className="vid-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Move up"
                      aria-label={`Move ${v.title} up`}
                      onClick={() => move(i, -1)}
                      disabled={busy || i === 0}
                    >
                      <Icon.Minus size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Move down"
                      aria-label={`Move ${v.title} down`}
                      onClick={() => move(i, 1)}
                      disabled={busy || i === videos.length - 1}
                    >
                      <Icon.Plus size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Change the title"
                      aria-label={`Change the title of ${v.title}`}
                      onClick={() => startEdit(v)}
                      disabled={busy}
                    >
                      <Icon.Edit size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Preview on the website"
                      aria-label={`Watch ${v.title}`}
                      onClick={() => window.open(`/videos#${v.slug}`, '_blank', 'noopener')}
                    >
                      <Icon.Play size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Remove this film"
                      aria-label={`Remove ${v.title}`}
                      onClick={() => setConfirm(v.slug)}
                      disabled={busy}
                    >
                      <Icon.Trash size={15} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------ confirm */}
      {confirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h4 className="h4">Remove this film?</h4>
            <p className="muted">
              It will be taken off the website and deleted. This cannot be undone, and you would
              have to upload it again.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirm(null)}
                disabled={busy}
              >
                Keep it
              </button>
              <button
                type="button"
                className="btn btn-red btn-sm"
                onClick={() => remove(confirm)}
                disabled={busy}
              >
                <Icon.Trash size={15} /> Yes, remove it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
