/**
 * Example gated page. Reached at /settings — no auth logic lives here
 * because (protected)/_layout.tsx already wraps the subtree in <AuthGate>.
 */

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { getUserColor, isImageFile, signOut, useAuth, useMutations, useQuery, useR2Files, useUser } from 'deepspace'
import { Avatar, AvatarFallback, AvatarImage, Button, Input, Label, Switch, useToast } from '@/components/ui'
import { isSoundOn, playChipClack, setSoundOn } from '@/lib/sound'
import { usePeople } from '@/lib/use-people'
import { parseVenmoUsername } from '@/lib/venmo'
import type { Profile } from '@/schemas/profiles-schema'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export default function SettingsPage() {
  const { user } = useUser()
  const [sound, setSound] = useState(isSoundOn)

  function toggleSound(on: boolean) {
    setSoundOn(on)
    setSound(on)
    // Let them hear what they just turned on.
    if (on) playChipClack()
  }

  return (
    // No background on page wrappers — pages render into whatever the app's
    // (app)/_layout provides (a plain background, or a raised panel), so they
    // stay transparent and inherit it.
    <div className="min-h-full text-foreground">
      <div className="mx-auto grid max-w-2xl gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight lg:text-4xl">Settings</h1>

        <ProfileSection />

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl font-bold">Your account</h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{user?.email ?? '—'}</dd>
            </div>
          </dl>

          <Button variant="secondary" className="mt-6" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-display text-xl font-bold">Table sounds</h2>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span>
              <span className="block font-medium">Chip sounds</span>
              <span className="block text-muted-foreground">A soft chip clack when a buy-in lands. Only on this device.</span>
            </span>
            <Switch checked={sound} onCheckedChange={toggleSound} />
          </label>
        </section>
      </div>
    </div>
  )
}

/** The name and picture other players see in this app. */
function ProfileSection() {
  const { userId } = useAuth()
  const { nameOf, imageOf } = usePeople()
  const { error } = useToast()
  const { records } = useQuery<Profile>('profiles', { where: { userId } })
  const { create, put, ready } = useMutations<Profile>('profiles')
  // 'app' scope: world-readable, which an avatar shown to other players needs.
  const { upload, getUrl, isUploading } = useR2Files({ scope: 'app' })
  const mine = records[0]
  const [draftName, setDraftName] = useState<string>()
  const [draftVenmo, setDraftVenmo] = useState<string>()
  const fileInput = useRef<HTMLInputElement>(null)

  if (!userId) return null
  const name = draftName ?? mine?.data.displayName ?? ''
  const savedVenmo = mine?.data.venmoUsername ?? ''
  const venmo = draftVenmo ?? (savedVenmo && `@${savedVenmo}`)

  function saveVenmo(e: FormEvent) {
    e.preventDefault()
    const username = venmo.trim() === '' ? '' : parseVenmoUsername(venmo)
    if (username === null) {
      return error("That doesn't look like a Venmo username", '5–30 letters, numbers, hyphens or underscores, like @calvin-poker.')
    }
    save({ venmoUsername: username })
    setDraftVenmo(undefined)
  }

  function save(patch: Partial<Profile>) {
    if (mine) put(mine.recordId, patch)
    else create({ userId: userId!, displayName: '', avatarUrl: '', ...patch })
  }

  function saveName(e: FormEvent) {
    e.preventDefault()
    save({ displayName: name.trim() })
    setDraftName(undefined)
  }

  async function changePicture(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!isImageFile(file.type)) return error('Pick an image file', 'PNG, JPG, GIF or WebP work.')
    if (file.size > MAX_AVATAR_BYTES) return error('That picture is too big', 'Pick one under 5 MB.')
    const result = await upload(file, file.name)
    const url = result.url ?? (result.key ? getUrl(result.key) : undefined)
    if (!result.success || !url) return error('Could not upload your picture', result.error)
    save({ avatarUrl: url })
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-display text-xl font-bold">Profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">How other players see you in this app.</p>

      <div className="mt-5 flex items-center gap-4">
        <Avatar className="size-16 ring-2 ring-primary">
          <AvatarImage src={imageOf(userId)} />
          <AvatarFallback className="text-xl font-semibold text-[#22150c]" style={{ background: getUserColor(userId) }}>
            {nameOf(userId).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={isUploading || !ready} onClick={() => fileInput.current?.click()}>
            {isUploading ? 'Uploading…' : 'Change picture'}
          </Button>
          <input
            ref={fileInput}
            id="avatar-file"
            type="file"
            accept="image/*"
            aria-label="Profile picture"
            className="sr-only"
            tabIndex={-1}
            onChange={changePicture}
          />
          {mine?.data.avatarUrl && (
            <Button variant="ghost" size="sm" disabled={!ready} onClick={() => save({ avatarUrl: '' })}>
              Use account picture
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={saveName} className="mt-5 grid gap-2">
        <Label htmlFor="display-name">Display name</Label>
        <div className="flex gap-2">
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={nameOf(userId)}
            maxLength={40}
            className="min-w-0"
          />
          <Button type="submit" disabled={!ready || name.trim() === (mine?.data.displayName ?? '')}>
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Leave it empty and save to use your account name.</p>
      </form>

      <form onSubmit={saveVenmo} className="mt-5 grid gap-2">
        <Label htmlFor="venmo-username">Venmo username</Label>
        <div className="flex gap-2">
          <Input
            id="venmo-username"
            value={venmo}
            onChange={(e) => setDraftVenmo(e.target.value)}
            placeholder="@your-venmo"
            maxLength={31}
            autoComplete="off"
            className="min-w-0"
          />
          <Button type="submit" disabled={!ready || venmo.trim().replace(/^@/, '') === savedVenmo}>
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          When you host, players who request a buy-in get a Venmo button with your name and the amount filled in. Any
          signed-in player can see it.
        </p>
      </form>
    </section>
  )
}
