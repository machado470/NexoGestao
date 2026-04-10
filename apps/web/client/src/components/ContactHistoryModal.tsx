import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Phone, Mail, MessageCircle, User, Plus, Trash2 } from "lucide-react";

type ContactType = "phone" | "email" | "whatsapp" | "in_person" | "other";

type ContactHistoryItem = {
  id: string;
  contactType: ContactType;
  subject: string;
  description: string | null;
  notes: string | null;
  contactedBy: string | null;
  createdAt: string | null;
};

interface ContactHistoryModalProps {
  customerId: string;
  customerName: string;
  trigger?: React.ReactNode;
}

function normalizeContactHistoryPayload(payload: unknown): ContactHistoryItem[] {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => {
    const candidate = (item ?? {}) as Partial<ContactHistoryItem>;

    return {
      id: typeof candidate.id === "string" ? candidate.id : "",
      contactType:
        candidate.contactType === "phone" ||
        candidate.contactType === "email" ||
        candidate.contactType === "whatsapp" ||
        candidate.contactType === "in_person" ||
        candidate.contactType === "other"
          ? candidate.contactType
          : "other",
      subject:
        typeof candidate.subject === "string" && candidate.subject.trim()
          ? candidate.subject
          : "Sem assunto",
      description:
        typeof candidate.description === "string" ? candidate.description : null,
      notes: typeof candidate.notes === "string" ? candidate.notes : null,
      contactedBy:
        typeof candidate.contactedBy === "string" ? candidate.contactedBy : null,
      createdAt:
        typeof candidate.createdAt === "string" ? candidate.createdAt : null,
    };
  });
}

function formatDate(value?: string | null) {
  if (!value) return "Data indisponível";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getContactTypeIcon(type: ContactType) {
  switch (type) {
    case "phone":
      return <Phone className="h-4 w-4" />;
    case "email":
      return <Mail className="h-4 w-4" />;
    case "whatsapp":
      return <MessageCircle className="h-4 w-4" />;
    case "in_person":
      return <User className="h-4 w-4" />;
    default:
      return <MessageCircle className="h-4 w-4" />;
  }
}

function getContactTypeLabel(type: ContactType) {
  switch (type) {
    case "phone":
      return "Telefone";
    case "email":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "in_person":
      return "Presencial";
    default:
      return "Outro";
  }
}

function getContactTypeColor(type: ContactType) {
  switch (type) {
    case "phone":
      return "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200";
    case "email":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "whatsapp":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "in_person":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    default:
      return "bg-[var(--surface-base)] text-[var(--text-primary)] dark:bg-[var(--surface-base)] dark:text-[var(--text-secondary)]";
  }
}

export function ContactHistoryModal({
  customerId,
  customerName,
  trigger,
}: ContactHistoryModalProps) {
  const [open, setOpen] = useState(false);
  const [contactType, setContactType] = useState<ContactType>("whatsapp");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [contactedBy, setContactedBy] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const contactHistoryQuery = trpc.contact.getContactHistory.useQuery(
    { customerId },
    {
      enabled: open,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const createContactMutation = trpc.contact.createContactHistory.useMutation({
    onSuccess: async () => {
      toast.success("Contato registrado com sucesso.");
      setSubject("");
      setDescription("");
      setNotes("");
      setContactedBy("");
      setContactType("whatsapp");
      await contactHistoryQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar contato.");
    },
  });

  const deleteContactMutation = trpc.contact.deleteContactHistory.useMutation({
    onSuccess: async () => {
      toast.success("Contato removido com sucesso.");
      setDeletingId(null);
      await contactHistoryQuery.refetch();
    },
    onError: (error) => {
      setDeletingId(null);
      toast.error(error.message || "Erro ao remover contato.");
    },
  });

  const contacts = useMemo(() => {
    return normalizeContactHistoryPayload(contactHistoryQuery.data);
  }, [contactHistoryQuery.data]);

  const handleCreateContact = async () => {
    const trimmedSubject = subject.trim();

    if (!trimmedSubject) {
      toast.error("Informe o assunto do contato.");
      return;
    }

    await createContactMutation.mutateAsync({
      customerId,
      contactType,
      subject: trimmedSubject,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      contactedBy: contactedBy.trim() || undefined,
    });
  };

  const handleDeleteContact = async (id: string) => {
    const confirmed = window.confirm("Tem certeza que deseja remover este contato?");
    if (!confirmed) return;

    setDeletingId(id);
    await deleteContactMutation.mutateAsync({ id });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <MessageCircle className="mr-2 h-4 w-4" />
            Histórico de Contatos
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Contatos — {customerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="border-dashed bg-gray-50 p-4 dark:bg-gray-900">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <Plus className="h-4 w-4" />
              Registrar Novo Contato
            </h3>

            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo de Contato
                </label>
                <select
                  value={contactType}
                  onChange={(e) => setContactType(e.target.value as ContactType)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Telefone</option>
                  <option value="email">Email</option>
                  <option value="in_person">Presencial</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Assunto *
                </label>
                <Input
                  placeholder="Ex: Envio de orçamento"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Descrição
                </label>
                <textarea
                  placeholder="Detalhes do contato..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  rows={2}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notas
                </label>
                <textarea
                  placeholder="Notas adicionais..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  rows={2}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quem fez o contato
                </label>
                <Input
                  placeholder="Seu nome"
                  value={contactedBy}
                  onChange={(e) => setContactedBy(e.target.value)}
                />
              </div>

              <Button
                onClick={() => void handleCreateContact()}
                disabled={createContactMutation.isPending || !subject.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                {createContactMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Registrar Contato
                  </>
                )}
              </Button>
            </div>
          </Card>

          <div>
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
              Contatos Anteriores
            </h3>

            {contactHistoryQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              </div>
            ) : contactHistoryQuery.isError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                Não foi possível carregar o histórico de contatos agora.
              </div>
            ) : contacts.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <MessageCircle className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>Nenhum contato registrado ainda.</p>
              </div>
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {contacts.map((contact) => (
                  <Card
                    key={contact.id}
                    className="border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${getContactTypeColor(
                              contact.contactType
                            )}`}
                          >
                            {getContactTypeIcon(contact.contactType)}
                            {getContactTypeLabel(contact.contactType)}
                          </span>

                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(contact.createdAt)}
                          </span>
                        </div>

                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {contact.subject}
                        </h4>

                        {contact.description ? (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {contact.description}
                          </p>
                        ) : null}

                        {contact.notes ? (
                          <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">
                            Notas: {contact.notes}
                          </p>
                        ) : null}

                        {contact.contactedBy ? (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Por: {contact.contactedBy}
                          </p>
                        ) : null}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteContact(contact.id)}
                        disabled={deleteContactMutation.isPending && deletingId === contact.id}
                        className="text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                      >
                        {deleteContactMutation.isPending && deletingId === contact.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
