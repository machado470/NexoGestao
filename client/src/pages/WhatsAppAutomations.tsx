import React, { useState } from "react";
import { MessageSquare, Plus, Edit2, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Automation {
  id: number;
  name: string;
  description?: string;
  triggerType: string;
  responseMessage: string;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt?: Date;
}

export default function WhatsAppAutomations() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    triggerType: "appointment_confirmed",
    responseMessage: "",
  });

  // Fetch automations
  const { data: automations = [], isLoading: automationsLoading } =
    trpc.whatsapp.getAutomations.useQuery();

  // Create automation
  const createMutation = trpc.whatsapp.createAutomation.useMutation({
    onSuccess: () => {
      resetForm();
      setIsOpen(false);
    },
  });

  // Update automation
  const updateMutation = trpc.whatsapp.updateAutomation.useMutation({
    onSuccess: () => {
      resetForm();
      setIsOpen(false);
    },
  });

  // Delete automation
  const deleteMutation = trpc.whatsapp.deleteAutomation.useMutation();

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      triggerType: "appointment_confirmed",
      responseMessage: "",
    });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.responseMessage.trim()) return;

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        ...formData,
      });
    } else {
      await createMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
        triggerType: formData.triggerType as "appointment_confirmed" | "appointment_reminder" | "appointment_canceled" | "service_order_created" | "service_order_completed" | "invoice_created" | "invoice_paid" | "custom_message",
        responseMessage: formData.responseMessage,
        isActive: true,
      });
    }
  };

  const handleEdit = (automation: any) => {
    setFormData({
      name: automation.name,
      description: automation.description || "",
      triggerType: automation.triggerType,
      responseMessage: automation.responseMessage,
    });
    setEditingId(automation.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja deletar esta automação?")) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const triggerTypes = [
    { value: "appointment_confirmed", label: "Agendamento Confirmado" },
    { value: "appointment_reminder", label: "Lembrete de Agendamento" },
    { value: "appointment_canceled", label: "Agendamento Cancelado" },
    { value: "service_order_created", label: "Ordem de Serviço Criada" },
    { value: "service_order_completed", label: "Ordem de Serviço Concluída" },
    { value: "invoice_created", label: "Fatura Criada" },
    { value: "invoice_paid", label: "Fatura Paga" },
    { value: "custom_message", label: "Mensagem Personalizada" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-orange-500" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Automações WhatsApp
          </h1>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsOpen(true);
          }}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Automação
        </Button>
      </div>

      {/* Automations List */}
      <div className="grid gap-4">
        {automationsLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : automations.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Nenhuma automação criada ainda
            </p>
          </Card>
        ) : (
          automations.map((automation: any) => (
            <Card
              key={automation.id}
              className="p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {automation.name}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        automation.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                      }`}
                    >
                      {automation.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  {automation.description && (
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {automation.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Tipo de Gatilho
                      </p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {triggerTypes.find(
                          (t) => t.value === automation.triggerType
                        )?.label || automation.triggerType}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Execuções
                      </p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {automation.executionCount}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-900/50 p-3 rounded mb-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Mensagem
                    </p>
                    <p className="text-gray-900 dark:text-white text-sm">
                      {automation.responseMessage}
                    </p>
                  </div>

                  {automation.lastExecutedAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Última execução:{" "}
                      {new Date(automation.lastExecutedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={() => handleEdit(automation)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(automation.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Automação" : "Nova Automação"}
            </DialogTitle>
            <DialogDescription>
              Configure uma automação para enviar mensagens WhatsApp
              automaticamente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Confirmação de Agendamento"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descrição (opcional)
              </label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descrição da automação"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Gatilho
              </label>
              <select
                value={formData.triggerType}
                onChange={(e) =>
                  setFormData({ ...formData, triggerType: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {triggerTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mensagem
              </label>
              <textarea
                value={formData.responseMessage}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    responseMessage: e.target.value,
                  })
                }
                placeholder="Digite a mensagem a ser enviada"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use variáveis para personalizar (ex: nome, data)
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => setIsOpen(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !formData.name.trim() ||
                  !formData.responseMessage.trim()
                }
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {editingId ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
