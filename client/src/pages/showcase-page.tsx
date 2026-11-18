import * as React from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataItem, DataList, Metric } from "@/components/ui/data-display";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  ErrorState,
  LoadingState,
  SkeletonTable,
} from "@/components/ui/loading-error-empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function ShowcasePage() {
  const [loading, setLoading] = React.useState(false);
  const [checked, setChecked] = React.useState(true);
  const [radio, setRadio] = React.useState("standard");
  const [showCommands, setShowCommands] = React.useState(false);

  const handleLoading = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1200);
  };

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-6xl space-y-10 pb-16">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="success" className="gap-1 px-2.5 py-0.5">
                <CheckCircle2Icon className="size-3" />
                Operational UI System
              </Badge>
              <span className="text-xs text-muted-foreground">WCAG 2.2 AA</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Component inventory
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Reusable operational patterns, ledger-first views, accessible
              forms, and tactile states engineered for the MillLedger ERP.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowCommands(true)}
            className="self-start gap-2 sm:self-auto"
          >
            <SearchIcon className="size-4" />
            Open command menu
          </Button>
        </header>

        {/* Quick Nav */}
        <nav
          aria-label="Component inventory sections"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm font-medium"
        >
          <a
            href="#actions"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground whitespace-nowrap"
          >
            Actions
          </a>
          <a
            href="#forms"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground whitespace-nowrap"
          >
            Forms
          </a>
          <a
            href="#surfaces"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground whitespace-nowrap"
          >
            Surfaces
          </a>
          <a
            href="#feedback"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground whitespace-nowrap"
          >
            Feedback
          </a>
          <a
            href="#data"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground whitespace-nowrap"
          >
            Data display
          </a>
        </nav>

        {/* Section 1: Actions */}
        <section id="actions" className="space-y-4 scroll-mt-16">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Actions
            </h2>
            <p className="text-xs text-muted-foreground">
              Primary, secondary, and consequential operations with explicit
              focus states.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Buttons and menus</CardTitle>
              <CardDescription>
                One primary action anchors each workspace; secondary and
                tertiary actions support.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Button>Save draft</Button>
                <Button variant="secondary">Export</Button>
                <Button variant="tertiary">View details</Button>
                <Button variant="destructive">
                  <Trash2Icon className="size-4" />
                  Delete
                </Button>
                <Button disabled>Disabled</Button>
                <Button onClick={handleLoading} disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner className="size-4" />
                      Saving
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label="Add item"
                    >
                      <PlusIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add item</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary">
                      Actions <ChevronDownIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={() => toast.info("Details opened")}
                    >
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem
                      checked={checked}
                      onCheckedChange={setChecked}
                    >
                      Show archived
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={radio}
                      onValueChange={setRadio}
                    >
                      <DropdownMenuRadioItem value="standard">
                        Standard view
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="compact">
                        Compact view
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="secondary">Filter</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <Label htmlFor="filter" className="text-xs">
                      Filter name
                    </Label>
                    <Input
                      id="filter"
                      className="mt-1.5"
                      placeholder="Search records"
                    />
                  </PopoverContent>
                </Popover>

                <ConfirmationDialog
                  triggerLabel="Post record"
                  title="Post this record?"
                  description="This creates a posted record. The action is confirmed only after the server commits it."
                  confirmLabel="Post record"
                  onConfirm={() => toast.success("Record post requested")}
                />

                <ConfirmationDialog
                  triggerLabel="Void record"
                  title="Void this record?"
                  description="Void is permanent and may require an audit reason in the real workflow."
                  confirmLabel="Void record"
                  destructive
                  onConfirm={() => toast.error("Void action cancelled in demo")}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 2: Forms */}
        <section id="forms" className="space-y-4 scroll-mt-16">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Forms
            </h2>
            <p className="text-xs text-muted-foreground">
              Labels, helper instructions, and inline errors stay adjacent to
              controls.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Field states</CardTitle>
                <CardDescription>
                  Validation and descriptions linked with aria attributes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <Label htmlFor="item-name">Item name</Label>
                    <Input id="item-name" defaultValue="Wheat flour" />
                    <FieldDescription>
                      Use the name the mill team recognizes.
                    </FieldDescription>
                  </Field>
                  <Field data-invalid>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      aria-invalid="true"
                      defaultValue="-12"
                    />
                    <FieldError>Enter a quantity of 0 kg or more.</FieldError>
                  </Field>
                  <Field>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Record a useful milling batch detail"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="date">Effective date</Label>
                    <DatePicker id="date" />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Choice controls</CardTitle>
                <CardDescription>
                  Accessible radios, selects, checkboxes, and switches with 44px
                  hit targets.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <Label>Category</Label>
                    <Select defaultValue="materials">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="materials">Raw materials</SelectItem>
                        <SelectItem value="finished">Finished goods</SelectItem>
                        <SelectItem value="packing">Packing</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <fieldset className="space-y-2 border-0 p-0 m-0">
                    <legend className="text-xs font-semibold text-foreground">
                      Review mode
                    </legend>
                    <RadioGroup value={radio} onValueChange={setRadio}>
                      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-foreground">
                        <RadioGroupItem
                          value="standard"
                          aria-label="Standard review"
                        />
                        Standard review
                      </label>
                      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-foreground">
                        <RadioGroupItem
                          value="compact"
                          aria-label="Compact review"
                        />
                        Compact review
                      </label>
                    </RadioGroup>
                  </fieldset>

                  <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-foreground">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => setChecked(value === true)}
                    />
                    Include inactive records
                  </label>

                  <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-foreground">
                    <Switch checked={checked} onCheckedChange={setChecked} />
                    Automatic background refresh
                  </label>
                </FieldGroup>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 3: Surfaces */}
        <section id="surfaces" className="space-y-4 scroll-mt-16">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Surfaces
            </h2>
            <p className="text-xs text-muted-foreground">
              Dialogs, sheets, drawers, and modal command palettes.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Overlays and sheets</CardTitle>
              <CardDescription>
                Focused context-preserving panels for desktop and touch
                viewports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Review record</DialogTitle>
                      <DialogDescription>
                        Review the values before finalizing the entry.
                      </DialogDescription>
                    </DialogHeader>
                    <DataList className="my-2">
                      <DataItem label="Item">Wheat flour</DataItem>
                      <DataItem label="Quantity">125.50 kg</DataItem>
                      <DataItem label="Status">Draft</DataItem>
                    </DataList>
                    <DialogFooter>
                      <Button variant="secondary">Edit</Button>
                      <Button>Confirm</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="secondary">Open side panel</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Record detail</SheetTitle>
                      <SheetDescription>
                        Supporting operational context remains in view.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <DataList>
                        <DataItem label="Reference">REC-1042</DataItem>
                        <DataItem label="Warehouse">
                          Raw Materials Bay A
                        </DataItem>
                        <DataItem label="Created by">Store Manager</DataItem>
                      </DataList>
                    </div>
                  </SheetContent>
                </Sheet>

                <Drawer>
                  <DrawerTrigger asChild>
                    <Button variant="secondary">Open drawer</Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Mobile drawer</DrawerTitle>
                      <DrawerDescription>
                        Optimized for touch-first handheld shopfloor actions.
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground">
                        Touch gestures, swipe-to-dismiss, and keyboard focus
                        trap are active.
                      </p>
                    </div>
                    <DrawerFooter>
                      <Button>Continue</Button>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>

                <Dialog open={showCommands} onOpenChange={setShowCommands}>
                  <DialogContent className="top-24 max-w-lg translate-y-0 p-0 overflow-hidden shadow-2xl">
                    <DialogTitle className="sr-only">Command menu</DialogTitle>
                    <Command>
                      <CommandInput placeholder="Search components..." />
                      <CommandList>
                        <CommandEmpty>No components found.</CommandEmpty>
                        <CommandGroup heading="Sections">
                          <CommandItem
                            onSelect={() => {
                              setShowCommands(false);
                              window.location.hash = "#actions";
                            }}
                          >
                            Actions
                          </CommandItem>
                          <CommandItem
                            onSelect={() => {
                              setShowCommands(false);
                              window.location.hash = "#forms";
                            }}
                          >
                            Forms
                          </CommandItem>
                          <CommandItem
                            onSelect={() => {
                              setShowCommands(false);
                              window.location.hash = "#data";
                            }}
                          >
                            Data display
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 4: Feedback */}
        <section id="feedback" className="space-y-4 scroll-mt-16">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Feedback
            </h2>
            <p className="text-xs text-muted-foreground">
              Explicit, perceivable states for routine notifications and
              consequential errors.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Alerts and toasts</CardTitle>
                <CardDescription>
                  High-contrast status banners with icons and contextual advice.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="success" title="Saved on this device">
                  The draft is stored locally and waiting to sync.
                </Alert>
                <Alert variant="warning" title="Stock is low">
                  80 kg remains below the safe reorder threshold.
                </Alert>
                <Alert variant="danger" title="Could not post">
                  No balance was changed. Review the payment details before
                  retrying.
                </Alert>
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => toast.success("Changes saved")}
                  >
                    Success toast
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => toast.error("Could not save")}
                  >
                    Error toast
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>States</CardTitle>
                <CardDescription>
                  Loading, empty, and retryable error state boundaries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="loading">
                  <TabsList className="w-full">
                    <TabsTrigger value="loading" className="flex-1">
                      Loading
                    </TabsTrigger>
                    <TabsTrigger value="empty" className="flex-1">
                      Empty
                    </TabsTrigger>
                    <TabsTrigger value="error" className="flex-1">
                      Error
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="loading" className="pt-2">
                    <LoadingState label="Loading records" />
                  </TabsContent>
                  <TabsContent value="empty" className="pt-2">
                    <Empty>
                      <EmptyTitle>No records</EmptyTitle>
                      <EmptyDescription>
                        Add the first record to begin tracking production.
                      </EmptyDescription>
                      <Button className="mt-2">
                        <PlusIcon className="size-4" />
                        Add record
                      </Button>
                    </Empty>
                  </TabsContent>
                  <TabsContent value="error" className="pt-2">
                    <ErrorState
                      description="The records could not be loaded. Active filters are preserved."
                      onRetry={() => toast.info("Retry requested")}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          <div className="overflow-hidden rounded-panel border border-border bg-card p-4">
            <SkeletonTable />
          </div>
        </section>

        {/* Section 5: Data Display */}
        <section id="data" className="space-y-4 scroll-mt-16">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Data display
            </h2>
            <p className="text-xs text-muted-foreground">
              Ledger-first tables with tabular numbers and semantic status
              indicators.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Metric
              label="Available stock"
              value="420 kg"
              detail="80 kg below reorder point"
            />
            <Metric
              label="Balance"
              value="₹12,500.00"
              detail="Due in 14 days"
            />
            <Metric
              label="Draft records"
              value="3"
              detail="Waiting for review"
            />
          </div>

          <Card className="max-w-full overflow-hidden">
            <CardHeader>
              <CardTitle>Record table</CardTitle>
              <CardDescription>
                Responsive table with tabular numerals, right-aligned
                quantities, and status badges.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs font-semibold">
                      REC-1042
                    </TableCell>
                    <TableCell className="font-medium">Wheat flour</TableCell>
                    <TableCell className="numeric text-right font-medium">
                      125.50 kg
                    </TableCell>
                    <TableCell>
                      <StatusIndicator status="success" label="Received" />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs font-semibold">
                      REC-1043
                    </TableCell>
                    <TableCell className="font-medium">Rice bran</TableCell>
                    <TableCell className="numeric text-right font-medium">
                      48.00 kg
                    </TableCell>
                    <TableCell>
                      <StatusIndicator status="warning" label="Needs review" />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#" isActive>
                      1
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#">2</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status badges</CardTitle>
              <CardDescription>
                Standardized status pills with icons for operational clarity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="success">
                  <CheckCircle2Icon className="size-3" />
                  Success
                </Badge>
                <Badge variant="warning">
                  <AlertCircleIcon className="size-3" />
                  Attention
                </Badge>
                <Badge variant="danger">
                  <AlertCircleIcon className="size-3" />
                  Blocked
                </Badge>
                <Badge variant="info">
                  <SearchIcon className="size-3" />
                  Informational
                </Badge>
                <Badge variant="neutral">Neutral</Badge>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}

export default ShowcasePage;
