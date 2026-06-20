import { STATUS_LABELS } from '../lib/constants.js'

export default function Badge({ status }) {
  if (!status) return null
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>
}
