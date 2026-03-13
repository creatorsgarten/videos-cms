import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '#/lib/utils'
import { Calendar } from '#/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'

export interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  ({ value, onChange, placeholder = 'Pick a date', disabled = false }, ref) => {
    const date = value ? new Date(value) : undefined

    return (
      <Popover>
        <PopoverTrigger
          ref={ref}
          disabled={disabled}
          className={cn(
            'flex items-center justify-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
            !date && 'text-muted-foreground',
          )}
        >
          <CalendarIcon size={16} />
          {date ? format(date, 'PPP') : <span>{placeholder}</span>}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              if (selectedDate) {
                onChange?.(format(selectedDate, 'yyyy-MM-dd'))
              }
            }}
            disabled={disabled}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    )
  },
)
DatePicker.displayName = 'DatePicker'
