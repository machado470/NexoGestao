import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Plus, Loader, Users, Shield, Briefcase, Eye } from "lucide-react";
import { CreatePersonModal } from "@/components/CreatePersonModal";
import { EditPersonModal } from "@/components/EditPersonModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface Person {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "manager" | "collaborator" | "viewer";
  department: string | null;
  status: "active" | "inactive" | "suspended";
  notes: string | null;
  createdAt: Date;
}

interface PeopleStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  byRole: {
    admin: number;
    manager: number;
    collaborator: number;
    viewer: number;
  };
}

interface RoleDistribution {
  name: string;
  value: number;
  fill: string;
}

interface DepartmentDistribution {
  department: string;
  count: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  collaborator: "Colaborador",
  viewer: "Visualizador",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Shield className="w-4 h-4" />,
  manager: <Briefcase className="w-4 h-4" />,
  collaborator: <Users className="w-4 h-4" />,
  viewer: <Eye className="w-4 h-4" />,
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  manager: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  collaborator: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  inactive: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function PeoplePage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [stats, setStats] = useState<PeopleStats | null>(null);
  const [roleDistribution, setRoleDistribution] = useState<RoleDistribution[]>([]);
  const [departmentDistribution, setDepartmentDistribution] = useState<DepartmentDistribution[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Queries
  const listPeople = trpc.people.people.list.useQuery({ page, limit });
  const peopleStats = trpc.people.people.stats.useQuery(undefined);
  const roleData = trpc.people.people.roleDistribution.useQuery(undefined);
  const deptData = trpc.people.people.departmentDistribution.useQuery(undefined);

  useEffect(() => {
    if (listPeople.data) {
      const response = listPeople.data as any;
      if (response && response.data && response.pagination) {
        setPeople(response.data);
        setPagination(response.pagination);
      }
    }
  }, [listPeople.data]);

  useEffect(() => {
    if (peopleStats.data) {
      setStats(peopleStats.data as PeopleStats);
    }
  }, [peopleStats.data]);

  useEffect(() => {
    if (roleData.data) {
      setRoleDistribution(roleData.data as RoleDistribution[]);
    }
  }, [roleData.data]);

  useEffect(() => {
    if (deptData.data) {
      setDepartmentDistribution(deptData.data as DepartmentDistribution[]);
    }
  }, [deptData.data]);

  useEffect(() => {
    if (listPeople.error) {
      toast.error("Erro ao carregar pessoas: " + listPeople.error.message);
    }
  }, [listPeople.error]);

  const handleCreateSuccess = () => {
    void listPeople.refetch();
    void peopleStats.refetch();
    void roleData.refetch();
    void deptData.refetch();
  };

  const deletePerson = trpc.people.people.delete.useMutation({
    onSuccess: () => {
      toast.success("Pessoa deletada com sucesso!");
      void listPeople.refetch();
      void peopleStats.refetch();
      setShowDeleteModal(false);
      setSelectedPersonId(null);
    },
    onError: (error) => {
      toast.error("Erro ao deletar pessoa: " + error.message);
    },
  });

  const handleEdit = (person: Person) => {
    setSelectedPersonId(person.id);
    setShowEditModal(true);
  };

  const handleDelete = (person: Person) => {
    setSelectedPersonId(person.id);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedPersonId) {
      deletePerson.mutate({ id: selectedPersonId });
    }
  };

  const columns = [
    {
      key: "name" as const,
      label: "Nome",
      sortable: true,
    },
    {
      key: "email" as const,
      label: "Email",
      sortable: true,
    },
    {
      key: "role" as const,
      label: "Função",
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${ROLE_COLORS[value]}`}>
          {ROLE_ICONS[value]}
          {ROLE_LABELS[value]}
        </span>
      ),
    },
    {
      key: "department" as const,
      label: "Departamento",
      render: (value: string | null) => value || "-",
    },
    {
      key: "status" as const,
      label: "Status",
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[value]}`}>
          {value === "active" ? "Ativo" : value === "inactive" ? "Inativo" : "Suspenso"}
        </span>
      ),
    },
  ];

  if (listPeople.isLoading && people.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Pessoas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie colaboradores e controle de acesso
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Pessoa
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total de Pessoas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.total}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ativas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.active}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Inativas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.inactive}
                </p>
              </div>
              <Users className="w-8 h-8 text-yellow-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Suspensas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.suspended}
                </p>
              </div>
              <Users className="w-8 h-8 text-red-500 opacity-20" />
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Distribution */}
        {roleDistribution.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Distribuição por Função
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {roleDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Department Distribution */}
        {departmentDistribution.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Distribuição por Departamento
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="department" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="count" fill="#F97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Todas as Pessoas
        </h3>
        <DataTable
          columns={columns}
          data={people}
          loading={false}
          searchable={true}
          searchFields={["name", "email", "department"]}
          emptyMessage="Nenhuma pessoa cadastrada. Adicione a primeira clicando em 'Adicionar Pessoa'."
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Modals */}
      <CreatePersonModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
      <EditPersonModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleCreateSuccess}
        personId={selectedPersonId}
      />
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Deletar Pessoa"
        message="Tem certeza que deseja deletar esta pessoa? Esta ação não pode ser desfeita."
        itemName={people.find((p) => p.id === selectedPersonId)?.name}
        isLoading={deletePerson.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
