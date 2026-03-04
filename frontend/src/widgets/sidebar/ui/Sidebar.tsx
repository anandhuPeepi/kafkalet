import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Plus } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { BrokerCard } from '@entities/broker'
import { useProfileStore, type Broker } from '@entities/profile'
import { BrokerFormDialog } from '@features/broker-connect'

interface Props {
  activeBrokerId?: string
  onBrokerSelect?: (broker: { profileId: string; brokerId: string; brokerName: string } | null) => void
}

export function Sidebar({ activeBrokerId, onBrokerSelect }: Props) {
  const { profiles, activeProfileId } = useProfileStore()

  const [addOpen, setAddOpen] = useState(false)

  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(224)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.min(480, Math.max(160, dragStartWidth.current + delta))
      setWidth(newWidth)
    }
    const onMouseUp = () => {
      isDragging.current = false
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const profile = profiles.find((p) => p.id === activeProfileId)
  const brokers = profile?.brokers ?? []

  const handleBrokerClick = (broker: Broker) => {
    if (activeBrokerId === broker.id) {
      onBrokerSelect?.(null)
      return
    }
    if (activeProfileId) {
      onBrokerSelect?.({ profileId: activeProfileId, brokerId: broker.id, brokerName: broker.name })
    }
  }

  return (
    <aside
      className="relative flex h-full flex-col border-r border-border shrink-0"
      style={{ width: collapsed ? 40 : width, transition: 'width 150ms' }}
    >
      {collapsed ? (
        <div className="flex h-full items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Brokers
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setAddOpen(true)}
                title="Add broker"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-1 pb-2">
            {brokers.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No brokers yet.
                <br />
                Click + to add one.
              </p>
            ) : (
              brokers.map((broker) => (
                <BrokerCard
                  key={broker.id}
                  broker={broker}
                  selected={activeBrokerId === broker.id}
                  onClick={() => handleBrokerClick(broker)}
                />
              ))
            )}
          </nav>
        </>
      )}

      {/* Drag handle for resize */}
      {!collapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors"
          onMouseDown={(e) => {
            isDragging.current = true
            dragStartX.current = e.clientX
            dragStartWidth.current = width
          }}
        />
      )}

      <BrokerFormDialog
        profileId={profile?.id ?? ''}
        open={addOpen && Boolean(profile)}
        onOpenChange={setAddOpen}
      />
    </aside>
  )
}
