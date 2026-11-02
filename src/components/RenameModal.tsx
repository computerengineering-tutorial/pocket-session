import React, { useEffect, useRef, useState } from "react"
import { Check, Pencil, X } from "lucide-react"
import { COLOR_TAGS } from "~lib/constants"
import type { ColorTag, SessionPocket } from "~types"

interface RenameModalProps {
  session: SessionPocket | null
  isOpen: boolean
  onClose: () => void
  onSave: (sessionId: string, newName: string, newTag?: ColorTag, notes?: string) => Promise<void>
}

const TAG_OPTIONS: ColorTag[] = [
  "indigo",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "purple",
  "slate"
]

export const RenameModal: React.FC<RenameModalProps> = ({
  session,
  isOpen,
  onClose,
  onSave
}) => {
  const [name, setName] = useState("")
  const [selectedTag, setSelectedTag] = useState<ColorTag>("indigo")
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (session) {
      setName(session.name)
      setSelectedTag(session.tag || "indigo")
      setNotes(session.notes || "")
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [session])

  if (!isOpen || !session) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isSaving) return

    setIsSaving(true)
    try {
      await onSave(session.id, name.trim(), selectedTag, notes.trim() || undefined)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-sm rounded-xl bg-[#0c0c0f] border border-zinc-800 shadow-2xl p-4 text-zinc-100 space-y-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 flex items-center justify-center">
              <Pencil className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-zinc-100">Edit Session Pocket</h3>
              <p className="text-[10px] font-mono text-zinc-400 truncate max-w-[190px]">
                {session.domain}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Pocket Name
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1.5">
              Color Tag
            </label>
            <div className="flex items-center gap-2">
              {TAG_OPTIONS.map((tag) => {
                const config = COLOR_TAGS[tag]
                const isSelected = selectedTag === tag
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    title={config.label}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      config.dot
                    } ${
                      isSelected
                        ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Work credentials"
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
