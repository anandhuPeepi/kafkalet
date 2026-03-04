import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

import {
  AddBrokerCredential,
  SetNamedCredentialPassword,
  type profile,
} from '@shared/api'
import { useProfileStore, type NamedCredential } from '@entities/profile'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  mechanism: z.string(),
  username: z.string(),
  password: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  profileId: string
  brokerId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function CredentialFormDialog({ profileId, brokerId, open, onOpenChange }: Props) {
  const { upsertProfile, profiles } = useProfileStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      mechanism: 'PLAIN',
      username: '',
      password: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
    }
  }, [open])

  const onSubmit = async (values: FormValues) => {
    try {
      const newCred = await AddBrokerCredential(profileId, brokerId, {
        id: '',
        name: values.name,
        sasl: {
          mechanism: values.mechanism,
          username: values.username,
          oauthTokenURL: '',
          oauthClientID: '',
          oauthScopes: [],
        },
      } as unknown as profile.NamedCredential) as unknown as NamedCredential

      if (values.password) {
        await SetNamedCredentialPassword(profileId, brokerId, newCred.id, values.password)
      }

      const currentProfile = profiles.find((p) => p.id === profileId)
      if (currentProfile) {
        const updatedBrokers = currentProfile.brokers.map((b) =>
          b.id === brokerId
            ? { ...b, credentials: [...(b.credentials ?? []), newCred] }
            : b
        )
        upsertProfile({ ...currentProfile, brokers: updatedBrokers })
      }

      onOpenChange(false)
    } catch (err) {
      form.setError('root', { message: String(err) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="admin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mechanism"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mechanism</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PLAIN">PLAIN</SelectItem>
                      <SelectItem value="SCRAM-SHA-256">SCRAM-SHA-256</SelectItem>
                      <SelectItem value="SCRAM-SHA-512">SCRAM-SHA-512</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password <span className="text-muted-foreground">(stored in keychain)</span></FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
