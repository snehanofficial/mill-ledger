import * as React from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import "../app.css";
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
import { Toaster } from "@/components/ui/sonner";
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
      <div className="showcase-shell">
        <header className="showcase-header">
          <div>
            <p className="showcase-kicker">MillLedger UI foundation</p>
            <h1>Component inventory</h1>
            <p className="showcase-summary">
              Reusable operational patterns, states and accessible interactions.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setShowCommands(true)}>
            <SearchIcon data-icon="inline-start" />
            Open command menu
          </Button>
        </header>

        <main className="showcase-main">
          <nav className="showcase-nav" aria-label="Component sections">
            <a href="#actions">Actions</a>
            <a href="#forms">Forms</a>
            <a href="#surfaces">Surfaces</a>
            <a href="#feedback">Feedback</a>
            <a href="#data">Data</a>
          </nav>

          <div className="showcase-content">
            <section id="actions" className="showcase-section">
              <div className="section-heading">
                <h2>Actions</h2>
                <p>Primary, secondary and consequential operations.</p>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Buttons and menus</CardTitle>
                  <CardDescription>
                    One primary action anchors each work area.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="control-row">
                    <Button>Save draft</Button>
                    <Button variant="secondary">Export</Button>
                    <Button variant="tertiary">View details</Button>
                    <Button variant="destructive">
                      <Trash2Icon data-icon="inline-start" />
                      Delete
                    </Button>
                    <Button disabled>Disabled</Button>
                    <Button onClick={handleLoading} disabled={loading}>
                      {loading ? (
                        <>
                          <Spinner />
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
                          <PlusIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add item</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="control-row">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary">
                          Actions <ChevronDownIcon data-icon="inline-end" />
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
                      <PopoverContent>
                        <Label htmlFor="filter">Filter name</Label>
                        <Input
                          id="filter"
                          className="mt-2"
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
                      onConfirm={() =>
                        toast.error("Void action cancelled in demo")
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="forms" className="showcase-section">
              <div className="section-heading">
                <h2>Forms</h2>
                <p>
                  Labels, instructions and validation stay adjacent to controls.
                </p>
              </div>
              <div className="showcase-grid two">
                <Card>
                  <CardHeader>
                    <CardTitle>Field states</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <Field>
                        <Label htmlFor="item-name">Item name</Label>
                        <Input id="item-name" defaultValue="Wheat flour" />
                        <FieldDescription>
                          Use the name the team recognizes.
                        </FieldDescription>
                      </Field>
                      <Field data-invalid>
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          aria-invalid="true"
                          defaultValue="-12"
                        />
                        <FieldError>
                          Enter a quantity of 0 kg or more.
                        </FieldError>
                      </Field>
                      <Field>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          placeholder="Record a useful detail"
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
                            <SelectItem value="materials">
                              Raw materials
                            </SelectItem>
                            <SelectItem value="finished">
                              Finished goods
                            </SelectItem>
                            <SelectItem value="packing">Packing</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <fieldset className="choice-fieldset">
                        <legend>Review mode</legend>
                        <RadioGroup value={radio} onValueChange={setRadio}>
                          <label className="choice-row">
                            <RadioGroupItem
                              value="standard"
                              aria-label="Standard review"
                            />
                            Standard
                          </label>
                          <label className="choice-row">
                            <RadioGroupItem
                              value="compact"
                              aria-label="Compact review"
                            />
                            Compact
                          </label>
                        </RadioGroup>
                      </fieldset>
                      <label className="choice-row">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setChecked(value === true)
                          }
                        />
                        Include inactive records
                      </label>
                      <label className="choice-row">
                        <Switch
                          checked={checked}
                          onCheckedChange={setChecked}
                        />
                        Automatic refresh
                      </label>
                    </FieldGroup>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section id="surfaces" className="showcase-section">
              <div className="section-heading">
                <h2>Surfaces</h2>
                <p>Dialogs, panels and temporary menus.</p>
              </div>
              <Card>
                <CardContent>
                  <div className="control-row">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="secondary">Open dialog</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Review record</DialogTitle>
                          <DialogDescription>
                            Review the values before continuing.
                          </DialogDescription>
                        </DialogHeader>
                        <DataList>
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
                            Supporting context remains in view.
                          </SheetDescription>
                        </SheetHeader>
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
                            Use this for compact touch-first actions.
                          </DrawerDescription>
                        </DrawerHeader>
                        <DrawerFooter>
                          <Button>Continue</Button>
                        </DrawerFooter>
                      </DrawerContent>
                    </Drawer>
                    <Dialog open={showCommands} onOpenChange={setShowCommands}>
                      <DialogContent className="top-24 translate-y-0 p-0">
                        <DialogTitle className="sr-only">
                          Command menu
                        </DialogTitle>
                        <Command>
                          <CommandInput placeholder="Search components" />
                          <CommandList>
                            <CommandEmpty>No components found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => setShowCommands(false)}
                              >
                                Actions
                              </CommandItem>
                              <CommandItem
                                onSelect={() => setShowCommands(false)}
                              >
                                Forms
                              </CommandItem>
                              <CommandItem
                                onSelect={() => setShowCommands(false)}
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

            <section id="feedback" className="showcase-section">
              <div className="section-heading">
                <h2>Feedback</h2>
                <p>
                  Explicit, perceivable states for routine and consequential
                  actions.
                </p>
              </div>
              <div className="showcase-grid two">
                <Card>
                  <CardHeader>
                    <CardTitle>Alerts and toasts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="stack">
                      <Alert variant="success" title="Saved on this device">
                        The draft is waiting to sync.
                      </Alert>
                      <Alert variant="warning" title="Stock is low">
                        80 kg remains below the reorder point.
                      </Alert>
                      <Alert variant="danger" title="Could not post">
                        No balance was changed. Review the payment details.
                      </Alert>
                      <div className="control-row">
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
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>States</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="loading">
                      <TabsList>
                        <TabsTrigger value="loading">Loading</TabsTrigger>
                        <TabsTrigger value="empty">Empty</TabsTrigger>
                        <TabsTrigger value="error">Error</TabsTrigger>
                      </TabsList>
                      <TabsContent value="loading">
                        <LoadingState label="Loading records" />
                      </TabsContent>
                      <TabsContent value="empty">
                        <Empty>
                          <EmptyTitle>No records</EmptyTitle>
                          <EmptyDescription>
                            Add the first record to begin.
                          </EmptyDescription>
                          <Button>
                            <PlusIcon data-icon="inline-start" />
                            Add record
                          </Button>
                        </Empty>
                      </TabsContent>
                      <TabsContent value="error">
                        <ErrorState
                          description="The records could not be loaded. Active filters are preserved."
                          onRetry={() => toast.info("Retry requested")}
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
              <SkeletonTable />
            </section>

            <section id="data" className="showcase-section">
              <div className="section-heading">
                <h2>Data display</h2>
                <p>Ledger-first tables and compact values.</p>
              </div>
              <div className="showcase-grid metrics">
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
              <Card className="table-card">
                <CardHeader>
                  <CardTitle>Record table</CardTitle>
                  <CardDescription>
                    Responsive table sample with status and numeric alignment.
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                        <TableCell>REC-1042</TableCell>
                        <TableCell>Wheat flour</TableCell>
                        <TableCell className="numeric text-right">
                          125.50 kg
                        </TableCell>
                        <TableCell>
                          <StatusIndicator status="success" label="Received" />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>REC-1043</TableCell>
                        <TableCell>Rice bran</TableCell>
                        <TableCell className="numeric text-right">
                          48.00 kg
                        </TableCell>
                        <TableCell>
                          <StatusIndicator
                            status="warning"
                            label="Needs review"
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <Pagination className="mt-5">
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
              <div className="control-row status-row">
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
            </section>
          </div>
        </main>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default ShowcasePage;
