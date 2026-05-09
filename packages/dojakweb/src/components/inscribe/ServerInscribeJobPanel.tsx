import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { sha256Hex } from '../../lib/dogetag/mydogeInscriptionVerify';
import {
  createInscribeJob,
  getInscribeJob,
  isInscribeJobsClientConfigured,
  runInscribeJob,
  uploadInscribeJobItemContent,
  type InscribeJobResponse,
} from '../../lib/inscribeJobs/commandDogInscribeJobs';
import { Label } from '@/components/ui/label';

export interface ServerInscribeJobPanelProps {
  file: File;
  contentBuffer: Buffer;
  contentType: string;
  feeRateKoinuPerKb: number;
  marker: 'ord' | 'dog';
}

export const ServerInscribeJobPanel: React.FC<ServerInscribeJobPanelProps> = ({
  file,
  contentBuffer,
  contentType,
  feeRateKoinuPerKb,
  marker,
}) => {
  const [job, setJob] = useState<InscribeJobResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const timerRef = useRef<number | null>(null);

  const stopPoll = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const refreshJob = useCallback(async () => {
    if (!job?.job_id) return;
    try {
      const j = await getInscribeJob(job.job_id, true);
      setJob(j);
    } catch {
      /* silent on poll */
    }
  }, [job?.job_id]);

  const terminal = (s: string) => s === 'complete' || s === 'failed';

  useEffect(() => {
    if (!job?.job_id || terminal(job.status)) {
      stopPoll();
      return;
    }
    stopPoll();
    const ms = job.status === 'processing' ? 5000 : 12000;
    timerRef.current = window.setInterval(() => {
      void refreshJob();
    }, ms);
    return () => stopPoll();
  }, [job?.job_id, job?.status, refreshJob, stopPoll]);

  if (!isInscribeJobsClientConfigured()) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs leading-relaxed text-text-secondary dark:text-white/60">
        <span className="font-semibold text-text-primary dark:text-white/80">Server deposit (optional)</span> — set{' '}
        <code className="text-[#FCD34D]/90">VITE_INSCRIBE_JOBS_API_KEY</code> to match command.dog{' '}
        <code className="text-[#FCD34D]/90">INSCRIBE_JOBS_API_KEY</code> to request a quoted deposit address and QR for
        this file on the operator wallet.
      </div>
    );
  }

  const onCreate = async () => {
    const ct = contentType.trim();
    if (!ct) {
      toast.error('Set content type before creating a server job.');
      return;
    }
    setBusy(true);
    try {
      const hash = await sha256Hex(contentBuffer);
      const j = await createInscribeJob({
        display_name: file.name,
        fee_rate_koinu_per_kb: feeRateKoinuPerKb,
        marker,
        inscribe_mode: 'p2pkh_core',
        items: [
          {
            filename: file.name,
            content_type: ct,
            content_length: contentBuffer.length,
            content_sha256: hash,
          },
        ],
      });
      setJob(j);
      toast.success('Deposit job created — send DOGE to the address or scan the QR.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const firstItem = job?.items[0];
  const hasUploaded = Boolean(firstItem?.has_content);
  const canRun =
    job &&
    job.funding_complete &&
    hasUploaded &&
    job.status === 'funded';

  const onUpload = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const b64 = contentBuffer.toString('base64');
      await uploadInscribeJobItemContent(job.job_id, 0, b64);
      const j = await getInscribeJob(job.job_id, false);
      setJob(j);
      toast.success('File bytes uploaded to the server.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onRun = async () => {
    if (!job) return;
    setBusy(true);
    try {
      await runInscribeJob(job.job_id);
      const j = await getInscribeJob(job.job_id, false);
      setJob(j);
      toast.success('Inscribe worker queued — polling status…');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-950/20 px-4 py-3 text-sm text-text-secondary dark:text-white/75">
      <div className="text-xs font-semibold uppercase tracking-wide text-sky-200/90">Server-side inscribe (beta)</div>
      <p className="text-xs leading-relaxed text-text-tertiary dark:text-white/55">
        Deposit to a per-job Core address, upload the same file bytes the job was quoted for, then the server broadcasts
        a <strong className="text-text-secondary dark:text-white/70">P2PKH inscription chain</strong> (same model as the{' '}
        <code className="text-[#FCD34D]/90">dog inscribe</code> CLI). With{' '}
        <code className="text-[#FCD34D]/90">inscribe_mode: p2pkh_core</code> (default), the quoted amount matches that
        broadcast path; see <code className="text-[#FCD34D]/90">inscribe_mode</code> /{' '}
        <code className="text-[#FCD34D]/90">inscribe_backend</code> on the job response.
      </p>
      {!job ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onCreate()}
          className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create deposit job for this file'}
        </button>
      ) : (
        <div className="space-y-3 border-t border-white/10 pt-3">
          <div className="flex flex-wrap gap-4">
            <div className="shrink-0 rounded-lg bg-white p-2">
              <QRCodeSVG value={job.dogecoin_uri} size={132} level="M" />
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-xs">
              <div>
                <Label className="text-text-tertiary dark:text-white/50">Pay to</Label>
                <div className="mt-0.5 break-all font-mono text-[11px] text-[#FCD34D]/90">{job.deposit_address}</div>
              </div>
              <div>
                <Label className="text-text-tertiary dark:text-white/50">URI (QR payload)</Label>
                <div className="mt-0.5 break-all font-mono text-[10px] text-text-secondary dark:text-white/60">{job.dogecoin_uri}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                    job.funding_complete
                      ? 'bg-emerald-500/20 text-emerald-100'
                      : 'bg-amber-500/20 text-amber-100'
                  }`}
                >
                  {job.funding_complete ? 'Funded' : 'Awaiting funds'}
                </span>
                <span className="rounded-md bg-black/30 px-2 py-1 text-[11px] text-text-secondary dark:text-white/60">
                  received {(job.received_sats / 1e8).toFixed(4)} / need {(job.required_sats / 1e8).toFixed(4)} DOGE
                </span>
                <span className="rounded-md bg-black/30 px-2 py-1 text-[11px] text-text-secondary dark:text-white/60">
                  status {job.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(job.dogecoin_uri).then(() => toast.success('URI copied'))}
                  className="rounded border border-white/20 px-2 py-1 text-[11px] text-text-primary dark:text-white/85 hover:bg-white/10"
                >
                  Copy URI
                </button>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      await refreshJob();
                      toast.success('Balance refreshed');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e));
                    } finally {
                      setSyncing(false);
                    }
                  }}
                  className="rounded border border-white/20 px-2 py-1 text-[11px] text-text-primary dark:text-white/85 hover:bg-white/10 disabled:opacity-50"
                >
                  Refresh from chain
                </button>
              </div>
              {!hasUploaded ? (
                <button
                  type="button"
                  disabled={busy || terminal(job.status)}
                  onClick={() => void onUpload()}
                  className="rounded-lg border border-sky-400/50 bg-sky-500/20 px-3 py-2 text-[11px] font-bold text-sky-100 hover:bg-sky-500/30 disabled:opacity-50"
                >
                  Upload file to server (required before run)
                </button>
              ) : null}
              {canRun ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRun()}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Start server inscribe
                </button>
              ) : null}
              {job.status === 'processing' ? (
                <p className="text-[11px] text-amber-200/90">Broadcasting… this can take a minute. Status polls automatically.</p>
              ) : null}
              {job.status === 'complete' && firstItem?.inscription_id ? (
                <p className="text-[11px] text-emerald-200/90">
                  Inscription: <span className="break-all font-mono">{firstItem.inscription_id}</span>
                </p>
              ) : null}
              {job.status === 'failed' ? (
                <p className="text-[11px] text-rose-300/95">
                  Failed{job.last_error ? `: ${job.last_error}` : '.'}{' '}
                  {firstItem?.item_error ? `Item: ${firstItem.item_error}` : null}
                </p>
              ) : null}
              <div className="font-mono text-[10px] text-text-tertiary dark:text-white/40">job_id {job.job_id}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
