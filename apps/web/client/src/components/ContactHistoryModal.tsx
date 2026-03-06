import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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

interface ContactHistoryModalProps {
  customerId: string;
  customerName: string;
  trigger?: React.ReactNode;
}

export function ContactHistoryModal({
  customerId,
  customerName,
  trigger,
}: ContactHistoryModalProps) {
  const [open, setOpen] = useState(false);
  const [contactType, setContactType] = useState<"phone" | "email" | "whatsapp" | "in_person" | "other">("whatsapp");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [contactedBy, setContactedBy] = useState("");

  // Queries
  const contactHistoryQuery = trpc.contact.getContactHistory.useQuery(
    { customerId },
    { enabled: open }
  );

  // Mutations
  const createContactMutation = trpc.contact.createContactHistory.useMutation();
  const deleteContactMutation = trpc.contact.deleteContactHistory.useMutation();

  // Enviar novo contato
  const handleCreateContact = async () => {
    if (!subject.trim()) return;

    try {
      await createContactMutation.mutateAsync({
        customerId,
        contactType,
        subject,
        description: description || undefined,
        notes: notes || undefined,
        contactedBy: contactedBy || undefined,
      });

      // Limpar formulário
      setSubject("");
      setDescription("");
      setNotes("");
      setContactedBy("");

      // Refetch
      await contactHistoryQuery.refetch();
    } catch (error) {
      console.error("Erro ao criar contato:", error);
    }
  };

  // Deletar contato
  const handleDeleteContact = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este contato?")) return;

    try {
      await deleteContactMutation.mutateAsync({ id });
      await contactHistoryQuery.refetch();
    } catch (error) {
      console.error("Erro ao deletar contato:", error);
    }
  };

  // Ícone do tipo de contato
  const getContactTypeIcon = (type: string) => {
    switch (type) {
      case "phone":
        return <Phone className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      case "whatsapp":
        return <MessageCircle className="w-4 h-4" />;
      case "in_person":
        return <User className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  // Cor do tipo de contato
  const getContactTypeColor = (type: string) => {
    switch (type) {
      case "phone":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "email":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "whatsapp":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "in_person":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  // Formatar data
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <MessageCircle className="w-4 h-4 mr-2" />
            Histórico de Contatos
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Contatos - {customerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Novo Contato */}
          <Card className="p-4 bg-gray-50 dark:bg-gray-900 border-dashed">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Registrar Novo Contato
            </h3>

            <div className="space-y-3">
              {/* Tipo de Contato */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Tipo de Contato
                </label>
                <select
                  value={contactType}
                  onChange={(e) =>
                    setContactType(
                      e.target.value as
                        | "phone"
                        | "email"
                        | "whatsapp"
                        | "in_person"
                        | "other"
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Telefone</option>
                  <option value="email">Email</option>
                  <option value="in_person">Presencial</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              {/* Assunto */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Assunto *
                </label>
                <Input
                  placeholder="Ex: Envio de orçamento"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Descrição
                </label>
                <textarea
                  placeholder="Detalhes do contato..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  rows={2}
                />
              </div>

              {/* Notas */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Notas
                </label>
                <textarea
                  placeholder="Notas adicionais..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  rows={2}
                />
              </div>

              {/* Quem fez contato */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Quem fez o contato
                </label>
                <Input
                  placeholder="Seu nome"
                  value={contactedBy}
                  onChange={(e) => setContactedBy(e.target.value)}
                />
              </div>

              <Button
                onClick={handleCreateContact}
                disabled={createContactMutation.isPending || !subject.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                {createContactMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar Contato
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Lista de Contatos */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Contatos Anteriores
            </h3>

            {contactHistoryQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : contactHistoryQuery.data?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum contato registrado ainda</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {contactHistoryQuery.data?.map((contact: any) => (
                  <Card
                    key={contact.id}
                    className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getContactTypeColor(
                              contact.contactType
                            )}`}
                          >
                            {getContactTypeIcon(contact.contactType)}
                            {contact.contactType === "in_person"
                              ? "Presencial"
                              : contact.contactType.charAt(0).toUpperCase() +
                                contact.contactType.slice(1)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(contact.createdAt)}
                          </span>
                        </div>

                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {contact.subject}
                        </h4>

                        {contact.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {contact.description}
                          </p>
                        )}

                        {contact.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                            Notas: {contact.notes}
                          </p>
                        )}

                        {contact.contactedBy && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Por: {contact.contactedBy}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(contact.id)}
                        disabled={deleteContactMutation.isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {deleteContactMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
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
