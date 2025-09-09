import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ChartLine, 
  Upload, 
  Plus, 
  Save, 
  RotateCcw, 
  Edit, 
  Trash2, 
  ArrowLeft,
  FileSpreadsheet,
  Calendar,
  Database
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { parseProjections } from "@/lib/projections";
import { useToast } from "@/hooks/use-toast";
import type { Projection } from "@shared/schema";

export default function Admin() {
  const [selectedWeek, setSelectedWeek] = useState("15");
  const [selectedSeason, setSeason] = useState("2025");
  const [newProjection, setNewProjection] = useState({
    name: "",
    team: "",
    pos: "",
    proj: "",
    opp: ""
  });
  const [editingProjection, setEditingProjection] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projections = [], isLoading } = useQuery<Projection[]>({
    queryKey: ['/api/projections', selectedSeason, selectedWeek]
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const parsed = await parseProjections(file);
      const response = await apiRequest('POST', '/api/projections/bulk', {
        week: selectedWeek,
        season: selectedSeason,
        projections: parsed
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
      toast({ 
        title: "Success", 
        description: `Successfully uploaded ${data.projections?.length || 0} projections` 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to upload projections", 
        variant: "destructive" 
      });
    }
  });

  const addProjectionMutation = useMutation({
    mutationFn: async (projection: any) => {
      const response = await apiRequest('POST', '/api/projections', {
        ...projection,
        week: selectedWeek,
        season: selectedSeason,
        proj: Number(projection.proj)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
      setNewProjection({ name: "", team: "", pos: "", proj: "", opp: "" });
      toast({ title: "Success", description: "Projection added successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add projection", 
        variant: "destructive" 
      });
    }
  });

  const updateProjectionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/projections/${id}`, {
        ...data,
        proj: Number(data.proj)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
      setEditingProjection(null);
      setEditData({});
      toast({ title: "Success", description: "Projection updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update projection", 
        variant: "destructive" 
      });
    }
  });

  const deleteProjectionMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/projections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
      toast({ title: "Success", description: "Projection deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete projection", 
        variant: "destructive" 
      });
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      bulkUploadMutation.mutate({ file });
    }
  };

  const handleAddProjection = () => {
    if (!newProjection.name || !newProjection.pos || !newProjection.proj) {
      toast({ 
        title: "Error", 
        description: "Name, position, and projection are required", 
        variant: "destructive" 
      });
      return;
    }
    addProjectionMutation.mutate(newProjection);
  };

  const handleEditProjection = (projection: Projection) => {
    setEditingProjection(projection.id);
    setEditData({
      name: projection.name,
      team: projection.team || "",
      pos: projection.pos,
      proj: projection.proj.toString(),
      opp: projection.opp || ""
    });
  };

  const handleSaveEdit = () => {
    if (editingProjection) {
      updateProjectionMutation.mutate({ 
        id: editingProjection, 
        data: editData 
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingProjection(null);
    setEditData({});
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* Header */}
      <header className="admin-panel text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <button className="flex items-center space-x-2 text-primary-foreground hover:text-primary-foreground/80 transition-colors" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back to Lineup Checker</span>
                </button>
              </Link>
            </div>
            
            <div className="flex items-center space-x-2">
              <Database className="w-6 h-6" />
              <h1 className="text-xl font-bold" data-testid="text-admin-title">
                StatChasers Admin Panel
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm opacity-90" data-testid="text-current-selection">
                {selectedSeason} • Week {selectedWeek}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Week/Season Selection */}
          <div className="card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary" />
              Time Period Selection
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Season</label>
                <select 
                  className="w-full px-3 py-2 border border-input rounded-md"
                  value={selectedSeason}
                  onChange={(e) => setSeason(e.target.value)}
                  data-testid="select-admin-season"
                >
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Week</label>
                <select 
                  className="w-full px-3 py-2 border border-input rounded-md"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  data-testid="select-admin-week"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
                    <option key={week} value={week.toString()}>
                      Week {week}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <ChartLine className="w-5 h-5 mr-2 text-primary" />
              Current Data
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="text-projection-count">
                  {projections.length}
                </div>
                <div className="text-sm text-muted-foreground">Total Projections</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent" data-testid="text-last-updated">
                  {projections.length > 0 && projections[0].updated_at 
                    ? new Date(projections[0].updated_at).toLocaleDateString()
                    : "Never"
                  }
                </div>
                <div className="text-sm text-muted-foreground">Last Updated</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Upload Section */}
        <div className="card rounded-lg border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Upload className="w-5 h-5 mr-2 text-primary" />
            Bulk Update Projections
          </h2>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <FileSpreadsheet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Upload StatChasers CSV</h3>
            <p className="text-muted-foreground mb-6">
              Replace all projections for Week {selectedWeek} with new data from your CSV file.
              <br />
              <span className="text-sm">Expected columns: sleeper_id, name, team, pos, proj, opp</span>
            </p>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              id="csvUpload"
              onChange={handleFileUpload}
              data-testid="input-bulk-upload"
            />
            <button 
              className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
              onClick={() => document.getElementById('csvUpload')?.click()}
              disabled={bulkUploadMutation.isPending}
              data-testid="button-bulk-upload"
            >
              {bulkUploadMutation.isPending ? "Uploading..." : "Select CSV File"}
            </button>
          </div>
        </div>

        {/* Add New Projection */}
        <div className="card rounded-lg border border-border p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-primary" />
            Add Individual Projection
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Player Name *</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-input rounded-md text-sm" 
                placeholder="e.g., Patrick Mahomes"
                value={newProjection.name}
                onChange={(e) => setNewProjection({...newProjection, name: e.target.value})}
                data-testid="input-add-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Team</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-input rounded-md text-sm" 
                placeholder="e.g., KC"
                value={newProjection.team}
                onChange={(e) => setNewProjection({...newProjection, team: e.target.value})}
                data-testid="input-add-team"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Position *</label>
              <select 
                className="w-full px-3 py-2 border border-input rounded-md text-sm"
                value={newProjection.pos}
                onChange={(e) => setNewProjection({...newProjection, pos: e.target.value})}
                data-testid="select-add-position"
              >
                <option value="">Select</option>
                <option value="QB">QB</option>
                <option value="RB">RB</option>
                <option value="WR">WR</option>
                <option value="TE">TE</option>
                <option value="K">K</option>
                <option value="DEF">DEF</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Projection *</label>
              <input 
                type="number" 
                step="0.1" 
                className="w-full px-3 py-2 border border-input rounded-md text-sm" 
                placeholder="0.0"
                value={newProjection.proj}
                onChange={(e) => setNewProjection({...newProjection, proj: e.target.value})}
                data-testid="input-add-projection"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Opponent</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-input rounded-md text-sm" 
                placeholder="@DEN or BYE"
                value={newProjection.opp}
                onChange={(e) => setNewProjection({...newProjection, opp: e.target.value})}
                data-testid="input-add-opponent"
              />
            </div>
            <div className="flex items-end">
              <button 
                className="w-full bg-accent text-accent-foreground px-4 py-2 rounded-md font-medium hover:bg-accent/90 transition-colors text-sm flex items-center justify-center gap-1"
                onClick={handleAddProjection}
                disabled={addProjectionMutation.isPending}
                data-testid="button-add-save"
              >
                <Plus className="w-4 h-4" />
                {addProjectionMutation.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>

        {/* Projections Table */}
        <div className="card rounded-lg border border-border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <FileSpreadsheet className="w-5 h-5 mr-2 text-primary" />
              All Projections - Week {selectedWeek}, {selectedSeason}
            </h2>
            <div className="flex gap-2">
              <button 
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2"
                data-testid="button-reset-defaults"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Defaults
              </button>
            </div>
          </div>
          
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="data-table sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">Player</th>
                    <th className="px-4 py-3 text-left">Team</th>
                    <th className="px-4 py-3 text-left">Pos</th>
                    <th className="px-4 py-3 text-right">Projection</th>
                    <th className="px-4 py-3 text-left">Opponent</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Loading projections...
                      </td>
                    </tr>
                  ) : projections.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No projections found for Week {selectedWeek}, {selectedSeason}
                      </td>
                    </tr>
                  ) : (
                    projections.map((proj, index) => (
                      <tr key={proj.id} className="projection-row" data-testid={`row-projection-${index}`}>
                        {editingProjection === proj.id ? (
                          // Edit mode
                          <>
                            <td className="px-4 py-3">
                              <input 
                                type="text" 
                                className="w-full px-2 py-1 border border-input rounded text-sm"
                                value={editData.name || ""}
                                onChange={(e) => setEditData({...editData, name: e.target.value})}
                                data-testid={`input-edit-name-${index}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="text" 
                                className="w-full px-2 py-1 border border-input rounded text-sm"
                                value={editData.team || ""}
                                onChange={(e) => setEditData({...editData, team: e.target.value})}
                                data-testid={`input-edit-team-${index}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select 
                                className="w-full px-2 py-1 border border-input rounded text-sm"
                                value={editData.pos || ""}
                                onChange={(e) => setEditData({...editData, pos: e.target.value})}
                                data-testid={`select-edit-position-${index}`}
                              >
                                <option value="QB">QB</option>
                                <option value="RB">RB</option>
                                <option value="WR">WR</option>
                                <option value="TE">TE</option>
                                <option value="K">K</option>
                                <option value="DEF">DEF</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="number" 
                                step="0.1"
                                className="w-full px-2 py-1 border border-input rounded text-sm text-right"
                                value={editData.proj || ""}
                                onChange={(e) => setEditData({...editData, proj: e.target.value})}
                                data-testid={`input-edit-projection-${index}`}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="text" 
                                className="w-full px-2 py-1 border border-input rounded text-sm"
                                value={editData.opp || ""}
                                onChange={(e) => setEditData({...editData, opp: e.target.value})}
                                data-testid={`input-edit-opponent-${index}`}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                className="text-accent hover:text-accent/80 mr-2"
                                onClick={handleSaveEdit}
                                disabled={updateProjectionMutation.isPending}
                                data-testid={`button-save-edit-${index}`}
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button 
                                className="text-muted-foreground hover:text-foreground"
                                onClick={handleCancelEdit}
                                data-testid={`button-cancel-edit-${index}`}
                              >
                                ×
                              </button>
                            </td>
                          </>
                        ) : (
                          // View mode
                          <>
                            <td className="px-4 py-3 font-medium">{proj.name}</td>
                            <td className="px-4 py-3">{proj.team || '-'}</td>
                            <td className="px-4 py-3">{proj.pos}</td>
                            <td className="px-4 py-3 text-right">{proj.proj.toFixed(1)}</td>
                            <td className="px-4 py-3">{proj.opp || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                className="text-primary hover:text-primary/80 mr-2"
                                onClick={() => handleEditProjection(proj)}
                                data-testid={`button-edit-${index}`}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                className="text-destructive hover:text-destructive/80"
                                onClick={() => deleteProjectionMutation.mutate(proj.id)}
                                disabled={deleteProjectionMutation.isPending}
                                data-testid={`button-delete-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
