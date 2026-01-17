/**
 * Upstream Design System - UI Components
 *
 * Re-exports all UI components for easy importing.
 * Based on design-system-prd.md
 */

// Core form controls
export { Button, buttonVariants } from "./button"
export { Input, inputVariants } from "./input"
export { Label } from "./label"
export { Checkbox } from "./checkbox"
export { Switch } from "./switch"
export { Textarea } from "./textarea"
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select"

// Chips and badges
export { Chip, chipVariants } from "./chip"
export { Badge, badgeVariants } from "./badge"

// Cards and containers
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
} from "./card"

// Dialogs and overlays
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./dialog"
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog"
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "./sheet"
export { Popover, PopoverContent, PopoverTrigger } from "./popover"
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu"

// Feedback and indicators
export { Progress, progressVariants, progressIndicatorVariants } from "./progress"
export { Alert, AlertTitle, AlertDescription } from "./alert"
export { Skeleton } from "./skeleton"
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

// Navigation
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

// Layout
export { ScrollArea, ScrollBar } from "./scroll-area"
export { Separator } from "./separator"
export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./resizable"

// Misc
export { Avatar, AvatarFallback, AvatarImage } from "./avatar"
export { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible"

// Agentic UI components
export { ModelSelector, type Model } from "./model-selector"
export {
  ProcessingStatus,
  StepIndicator,
  stepIndicatorVariants,
  type ProcessingStep,
  type StepStatus,
} from "./processing-status"
export {
  QuickActions,
  QuickActionButton,
  quickActionVariants,
  type QuickAction,
} from "./quick-actions"
export { ThemeToggle } from "./theme-toggle"

// Empty states and feedback
export { EmptyState, emptyStateVariants } from "./empty-state"

// Metrics and data display
export { StatCard, statCardVariants, statIconVariants } from "./stat-card"
export {
  ConfidenceScore,
  confidenceBarVariants,
  confidenceBadgeVariants,
  confidenceDotVariants,
  getConfidenceLevel,
  getConfidenceLabel,
} from "./confidence-score"
export {
  StatusTimeline,
  timelineItemVariants,
  timelineIndicatorVariants,
  timelineConnectorVariants,
} from "./status-timeline"
