import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Trash2, Plus, UserCheck } from 'lucide-react'

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
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'

import {
  AddBroker,
  UpdateBroker,
  SetSchemaRegistryPassword,
  TestBrokerConnection,
  TestConnectionDirect,
  AddBrokerCredential,
  DeleteBrokerCredential,
  SetNamedCredentialPassword,
  SwitchBrokerCredential,
  type profile,
} from '@shared/api'
import { useProfileStore, type Broker, type NamedCredential } from '@entities/profile'

const baseSchema = z.object({
  name: z.string().min(1, 'Required'),
  addresses: z.string().min(1, 'Required'),
  tlsEnabled: z.boolean(),
  srUrl: z.string(),
  srUsername: z.string(),
  srPassword: z.string(),
  // Initial user fields (add mode only)
  initialCredName: z.string(),
  initialCredMechanism: z.string(),
  initialCredUsername: z.string(),
  initialCredPassword: z.string(),
  initialCredOAuthTokenURL: z.string(),
  initialCredOAuthClientId: z.string(),
  initialCredOAuthScopes: z.string(),
})

function buildSchema(isEdit: boolean) {
  if (isEdit) return baseSchema
  return baseSchema.superRefine((data, ctx) => {
    if (!data.initialCredName.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['initialCredName'] })
    }
    const isOAuth = data.initialCredMechanism === 'OAUTHBEARER'
    if (!isOAuth) {
      if (!data.initialCredUsername.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['initialCredUsername'] })
      }
      if (!data.initialCredPassword) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['initialCredPassword'] })
      }
    } else {
      if (!data.initialCredPassword) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Required', path: ['initialCredPassword'] })
      }
    }
  })
}

type FormValues = z.infer<typeof baseSchema>

const credSchema = z.object({
  credName: z.string().min(1, 'Required'),
  credMechanism: z.string(),
  credUsername: z.string(),
  credPassword: z.string(),
})

type CredFormValues = z.infer<typeof credSchema>

function buildTestParams(values: {
  addresses: string
  tlsEnabled: boolean
  initialCredMechanism: string
  initialCredUsername: string
  initialCredPassword: string
  initialCredOAuthTokenURL: string
  initialCredOAuthClientId: string
  initialCredOAuthScopes: string
}) {
  const addresses = values.addresses.split(',').map((s) => s.trim()).filter(Boolean)
  const mechanism = values.initialCredMechanism
  const isOAuth = mechanism === 'OAUTHBEARER'
  const tls = { enabled: values.tlsEnabled, insecureSkipVerify: false, caCertPath: '', clientCertPath: '', clientKeyPath: '' } as unknown as profile.TLSConfig
  const sasl = isOAuth
    ? { mechanism: 'OAUTHBEARER', username: '', oauthTokenURL: values.initialCredOAuthTokenURL, oauthClientID: values.initialCredOAuthClientId, oauthScopes: values.initialCredOAuthScopes.split(' ').filter(Boolean) } as unknown as profile.SASLConfig
    : { mechanism, username: values.initialCredUsername, oauthTokenURL: '', oauthClientID: '', oauthScopes: [] } as unknown as profile.SASLConfig
  return { addresses, tls, sasl, password: values.initialCredPassword }
}

interface Props {
  profileId: string
  broker?: Broker
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function BrokerFormDialog({ profileId, broker, open, onOpenChange }: Props) {
  const isEdit = Boolean(broker)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [credDeleteTarget, setCredDeleteTarget] = useState<NamedCredential | null>(null)
  const [addingCred, setAddingCred] = useState(false)
  const [addTesting, setAddTesting] = useState(false)
  const [addTestResult, setAddTestResult] = useState<string | null>(null)
  const [autoTesting, setAutoTesting] = useState(false)
  const [credAddTesting, setCredAddTesting] = useState(false)
  const [credAddTestResult, setCredAddTestResult] = useState<string | null>(null)
  const { upsertProfile, profiles } = useProfileStore()

  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(isEdit)),
    defaultValues: {
      name: broker?.name ?? '',
      addresses: broker?.addresses.join(', ') ?? '',
      tlsEnabled: broker?.tls.enabled ?? false,
      srUrl: broker?.schemaRegistry?.url ?? '',
      srUsername: broker?.schemaRegistry?.username ?? '',
      srPassword: '',
      initialCredName: '',
      initialCredMechanism: 'PLAIN',
      initialCredUsername: '',
      initialCredPassword: '',
      initialCredOAuthTokenURL: '',
      initialCredOAuthClientId: '',
      initialCredOAuthScopes: '',
    },
  })

  const credForm = useForm<CredFormValues>({
    resolver: zodResolver(credSchema),
    defaultValues: {
      credName: '',
      credMechanism: 'PLAIN',
      credUsername: '',
      credPassword: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: broker?.name ?? '',
        addresses: broker?.addresses.join(', ') ?? '',
        tlsEnabled: broker?.tls.enabled ?? false,
        srUrl: broker?.schemaRegistry?.url ?? '',
        srUsername: broker?.schemaRegistry?.username ?? '',
        srPassword: '',
        initialCredName: '',
        initialCredMechanism: 'PLAIN',
        initialCredUsername: '',
        initialCredPassword: '',
        initialCredOAuthTokenURL: '',
        initialCredOAuthClientId: '',
        initialCredOAuthScopes: '',
      })
      setTestResult(null)
      setAddTesting(false)
      setAddTestResult(null)
      setAutoTesting(false)
      setAddingCred(false)
      setCredAddTesting(false)
      setCredAddTestResult(null)
      credForm.reset()
    }
  }, [open, broker])

  const onSubmit = async (values: FormValues) => {
    // Auto-test connection before saving in add mode
    if (!isEdit) {
      setAutoTesting(true)
      setAddTestResult(null)
      try {
        const params = buildTestParams(values)
        await TestConnectionDirect(params.addresses, params.tls, params.sasl, params.password)
      } catch (err) {
        setAddTestResult(String(err))
        setAutoTesting(false)
        return
      }
      setAutoTesting(false)
    }

    const addresses = values.addresses.split(',').map((s) => s.trim()).filter(Boolean)
    const brokerData: Broker = {
      id: broker?.id ?? '',
      name: values.name,
      addresses,
      sasl: { mechanism: '', username: '' },
      tls: {
        enabled: values.tlsEnabled,
        insecureSkipVerify: false,
        caCertPath: '',
        clientCertPath: '',
        clientKeyPath: '',
      },
      schemaRegistry: {
        url: values.srUrl.trim(),
        username: values.srUsername,
      },
      credentials: broker?.credentials,
      activeCredentialID: broker?.activeCredentialID,
    }

    try {
      let savedBroker: Broker
      if (isEdit) {
        await UpdateBroker(profileId, brokerData as unknown as profile.Broker)
        savedBroker = brokerData
      } else {
        savedBroker = await AddBroker(profileId, brokerData as unknown as profile.Broker) as unknown as Broker
      }

      if (values.srPassword) {
        await SetSchemaRegistryPassword(profileId, savedBroker.id, values.srPassword)
      }

      // Add initial credential for new brokers
      if (!isEdit && values.initialCredName.trim()) {
        const mechanism = values.initialCredMechanism
        const isOAuth = mechanism === 'OAUTHBEARER'
        const newCred = await AddBrokerCredential(profileId, savedBroker.id, {
          id: '',
          name: values.initialCredName.trim(),
          sasl: isOAuth
            ? {
                mechanism: 'OAUTHBEARER',
                username: '',
                oauthTokenURL: values.initialCredOAuthTokenURL,
                oauthClientID: values.initialCredOAuthClientId,
                oauthScopes: values.initialCredOAuthScopes.split(' ').filter(Boolean),
              }
            : {
                mechanism,
                username: values.initialCredUsername,
                oauthTokenURL: '',
                oauthClientID: '',
                oauthScopes: [],
              },
        } as unknown as profile.NamedCredential) as unknown as NamedCredential

        if (values.initialCredPassword) {
          await SetNamedCredentialPassword(profileId, savedBroker.id, newCred.id, values.initialCredPassword)
        }

        await SwitchBrokerCredential(profileId, savedBroker.id, newCred.id)
        savedBroker = { ...savedBroker, credentials: [newCred], activeCredentialID: newCred.id }
      }

      const currentProfile = profiles.find((p) => p.id === profileId)
      if (currentProfile) {
        const brokers = isEdit
          ? currentProfile.brokers.map((b) => (b.id === savedBroker.id ? savedBroker : b))
          : [...currentProfile.brokers, savedBroker]
        upsertProfile({ ...currentProfile, brokers })
      }

      onOpenChange(false)
    } catch (err) {
      form.setError('root', { message: String(err) })
    }
  }

  const handleTest = async () => {
    if (!broker) return
    setTesting(true)
    setTestResult(null)
    try {
      await TestBrokerConnection(profileId, broker.id)
      setTestResult('Connection successful')
    } catch (err) {
      setTestResult(`${String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  const handleTestDirect = async () => {
    const values = form.getValues()
    const params = buildTestParams(values)
    if (params.addresses.length === 0) return
    setAddTesting(true)
    setAddTestResult(null)
    try {
      await TestConnectionDirect(params.addresses, params.tls, params.sasl, params.password)
      setAddTestResult('Connection successful')
    } catch (err) {
      setAddTestResult(String(err))
    } finally {
      setAddTesting(false)
    }
  }

  const handleCredTest = async () => {
    if (!broker) return
    const values = credForm.getValues()
    setCredAddTesting(true)
    setCredAddTestResult(null)
    try {
      await TestConnectionDirect(
        broker.addresses,
        broker.tls as unknown as profile.TLSConfig,
        { mechanism: values.credMechanism, username: values.credUsername, oauthTokenURL: '', oauthClientID: '', oauthScopes: [] } as unknown as profile.SASLConfig,
        values.credPassword
      )
      setCredAddTestResult('Connection successful')
    } catch (err) {
      setCredAddTestResult(String(err))
    } finally {
      setCredAddTesting(false)
    }
  }

  const handleAddCredential = async (values: CredFormValues) => {
    if (!broker) return

    // Auto-test before saving
    setCredAddTesting(true)
    setCredAddTestResult(null)
    try {
      await TestConnectionDirect(
        broker.addresses,
        broker.tls as unknown as profile.TLSConfig,
        { mechanism: values.credMechanism, username: values.credUsername, oauthTokenURL: '', oauthClientID: '', oauthScopes: [] } as unknown as profile.SASLConfig,
        values.credPassword
      )
    } catch (err) {
      setCredAddTestResult(String(err))
      setCredAddTesting(false)
      return
    }
    setCredAddTesting(false)

    try {
      const newCred = await AddBrokerCredential(profileId, broker.id, {
        id: '',
        name: values.credName,
        sasl: {
          mechanism: values.credMechanism,
          username: values.credUsername,
          oauthTokenURL: '',
          oauthClientID: '',
          oauthScopes: [],
        },
      } as unknown as profile.NamedCredential) as unknown as NamedCredential

      if (values.credPassword) {
        await SetNamedCredentialPassword(profileId, broker.id, newCred.id, values.credPassword)
      }

      const currentProfile = profiles.find((p) => p.id === profileId)
      if (currentProfile) {
        const updatedBrokers = currentProfile.brokers.map((b) =>
          b.id === broker.id
            ? { ...b, credentials: [...(b.credentials ?? []), newCred] }
            : b
        )
        upsertProfile({ ...currentProfile, brokers: updatedBrokers })
      }

      credForm.reset()
      setAddingCred(false)
      setCredAddTestResult(null)
    } catch (err) {
      credForm.setError('root', { message: String(err) })
    }
  }

  const handleDeleteCredential = async (cred: NamedCredential) => {
    if (!broker) return
    await DeleteBrokerCredential(profileId, broker.id, cred.id)
    const currentProfile = profiles.find((p) => p.id === profileId)
    if (currentProfile) {
      const updatedBrokers = currentProfile.brokers.map((b) =>
        b.id === broker.id
          ? { ...b, credentials: (b.credentials ?? []).filter((c) => c.id !== cred.id) }
          : b
      )
      upsertProfile({ ...currentProfile, brokers: updatedBrokers })
    }
    setCredDeleteTarget(null)
  }

  const initialCredMechanism = form.watch('initialCredMechanism')
  const initialCredIsOAuth = initialCredMechanism === 'OAUTHBEARER'
  const initialCredOAuthTokenURL = form.watch('initialCredOAuthTokenURL')
  const initialCredIsClientCreds = initialCredIsOAuth && initialCredOAuthTokenURL.trim() !== ''
  const storeProfile = profiles.find((p) => p.id === profileId)
  const storeBroker = storeProfile?.brokers.find((b) => b.id === broker?.id)
  const credentials = storeBroker?.credentials ?? broker?.credentials ?? []
  const activeCredentialID = storeBroker?.activeCredentialID ?? broker?.activeCredentialID

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Broker' : 'Add Broker'}</DialogTitle>
          </DialogHeader>

          {isEdit ? (
            <Tabs defaultValue="connection">
              <TabsList className="w-full">
                <TabsTrigger value="connection" className="flex-1">Connection</TabsTrigger>
                <TabsTrigger value="users" className="flex-1">
                  Users {credentials.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({credentials.length})</span>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="connection">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                    <ConnectionFormFields form={form} />
                    {form.formState.errors.root && (
                      <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                    )}
                    {testResult && (
                      <p className={testResult.startsWith('Connection') ? 'text-sm text-green-500' : 'text-sm text-destructive'}>
                        {testResult}
                      </p>
                    )}
                    <DialogFooter className="gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                        {testing && <Loader2 className="animate-spin" />}
                        Test Connection
                      </Button>
                      <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
                        Save
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="users" className="space-y-3">
                {credentials.length === 0 && !addingCred && (
                  <p className="text-xs text-muted-foreground">No named credentials yet.</p>
                )}
                {credentials.map((cred) => (
                  <div
                    key={cred.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{cred.name}</p>
                      <p className="text-xs text-muted-foreground">{cred.sasl.mechanism} {cred.sasl.username && `· ${cred.sasl.username}`}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {activeCredentialID === cred.id && (
                        <UserCheck className="h-3.5 w-3.5 text-primary" aria-label="Active" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setCredDeleteTarget(cred)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {addingCred ? (
                  <Form {...credForm}>
                    <form onSubmit={credForm.handleSubmit(handleAddCredential)} className="space-y-3 rounded-md border border-border p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New User</p>
                      <FormField
                        control={credForm.control}
                        name="credName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Name</FormLabel>
                            <FormControl>
                              <Input placeholder="admin" className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={credForm.control}
                        name="credMechanism"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Mechanism</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-8 text-sm">
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
                        control={credForm.control}
                        name="credUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Username</FormLabel>
                            <FormControl>
                              <Input className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={credForm.control}
                        name="credPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Password <span className="text-muted-foreground">(stored in keychain)</span></FormLabel>
                            <FormControl>
                              <Input type="password" className="h-8 text-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {credForm.formState.errors.root && (
                        <p className="text-xs text-destructive">{credForm.formState.errors.root.message}</p>
                      )}
                      {credAddTestResult && (
                        <p className={credAddTestResult === 'Connection successful' ? 'text-xs text-green-500' : 'text-xs text-destructive'}>
                          {credAddTestResult}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={credForm.formState.isSubmitting || credAddTesting}>
                          {(credForm.formState.isSubmitting || credAddTesting) && <Loader2 className="animate-spin" />}
                          {credAddTesting ? 'Testing...' : 'Add'}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleCredTest} disabled={credAddTesting}>
                          Test
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setAddingCred(false); credForm.reset(); setCredAddTestResult(null) }}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-full text-xs"
                    onClick={() => setAddingCred(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add User
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <ConnectionFormFields form={form} />

                <Separator />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  User
                </p>

                <FormField
                  control={form.control}
                  name="initialCredName"
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
                  name="initialCredMechanism"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SASL Mechanism</FormLabel>
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
                          <SelectItem value="OAUTHBEARER">OAUTHBEARER</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!initialCredIsOAuth && (
                  <>
                    <FormField
                      control={form.control}
                      name="initialCredUsername"
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
                      name="initialCredPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Password{' '}
                            <span className="text-muted-foreground">(stored in keychain)</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {initialCredIsOAuth && (
                  <>
                    <FormField
                      control={form.control}
                      name="initialCredOAuthTokenURL"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Token URL{' '}
                            <span className="text-muted-foreground">(optional — leave blank for static token)</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="https://auth.example.com/oauth/token" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {initialCredIsClientCreds && (
                      <>
                        <FormField
                          control={form.control}
                          name="initialCredOAuthClientId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Client ID</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="initialCredOAuthScopes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Scopes{' '}
                                <span className="text-muted-foreground">(space-separated, optional)</span>
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="kafka openid" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    <FormField
                      control={form.control}
                      name="initialCredPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {initialCredIsClientCreds ? 'Client Secret' : 'Bearer Token'}{' '}
                            <span className="text-muted-foreground">(stored in keychain)</span>
                          </FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {form.formState.errors.root && (
                  <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                )}
                {addTestResult && (
                  <p className={addTestResult === 'Connection successful' ? 'text-sm text-green-500' : 'text-sm text-destructive'}>
                    {addTestResult}
                  </p>
                )}
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleTestDirect} disabled={addTesting}>
                    {addTesting && <Loader2 className="animate-spin" />}
                    Test Connection
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting || autoTesting}>
                    {(form.formState.isSubmitting || autoTesting) && <Loader2 className="animate-spin" />}
                    {autoTesting ? 'Testing...' : 'Add Broker'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete credential confirmation */}
      <AlertDialog open={Boolean(credDeleteTarget)} onOpenChange={(v) => !v && setCredDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Delete user "{credDeleteTarget?.name}"? Their keychain password will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => credDeleteTarget && handleDeleteCredential(credDeleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ConnectionFormFieldsProps {
  form: ReturnType<typeof useForm<FormValues>>
}

function ConnectionFormFields({ form }: ConnectionFormFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="kafka-prod" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="addresses"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bootstrap Servers</FormLabel>
            <FormControl>
              <Input placeholder="broker1:9092, broker2:9092" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Separator />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        TLS
      </p>

      <FormField
        control={form.control}
        name="tlsEnabled"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2">
            <FormControl>
              <input
                type="checkbox"
                checked={field.value}
                onChange={field.onChange}
                className="h-4 w-4 rounded border-border"
              />
            </FormControl>
            <FormLabel className="!mt-0">Enable TLS</FormLabel>
          </FormItem>
        )}
      />

      <Separator />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Schema Registry
      </p>

      <FormField
        control={form.control}
        name="srUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              URL{' '}
              <span className="text-muted-foreground">(optional — enables Avro decoding)</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="http://localhost:8081" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {form.watch('srUrl').trim() && (
        <>
          <FormField
            control={form.control}
            name="srUsername"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username <span className="text-muted-foreground">(optional)</span></FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="srPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Password{' '}
                  <span className="text-muted-foreground">(stored in keychain)</span>
                </FormLabel>
                <FormControl>
                  <Input type="password" placeholder="leave blank to keep existing" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </>
  )
}
