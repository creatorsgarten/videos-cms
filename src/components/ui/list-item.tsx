import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#/lib/utils'

const listItemVariants = cva(
  'flex items-center rounded-md px-4 py-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'hover:bg-accent hover:text-accent-foreground cursor-pointer',
        ghost: 'hover:bg-gray-100',
      },
    },
    defaultVariants: {
      variant: 'ghost',
    },
  },
)

interface ListItemProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof listItemVariants> {}

const ListItem = React.forwardRef<HTMLDivElement, ListItemProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(listItemVariants({ variant, className }))}
      {...props}
    />
  ),
)
ListItem.displayName = 'ListItem'

export { ListItem, listItemVariants }
