import React, { useState, useEffect } from "react";
import { X, Upload, Plus, Save, RotateCcw, Edit, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { parseProjections, buildProjectionIndex } from "@/lib/projections";
import { saveProjections, loadProjections, clearProjections } from "@/lib/storage";
import { loadBuiltInOrSaved } from "@/lib/builtin";
import { useToast } from "@/hooks/use-toast";
import type { Projection } from "@shared/schema";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: string;
  currentSeason: string;
};

export default function AdminModal({ isOpen, onClose, currentWeek, currentSeason }: Props) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [usingSavedMsg, setUsingSavedMsg] = useState<string | null>(null);
  const [newProjection, setNewProjection] = useState({
    name: "",
    team: "",
    pos: "",
    proj: "",
    opp: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sync selectedWeek with currentWeek prop changes
  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

  // Auto-load saved projections when season/week changes
  useEffect(() => {
    (async () => {
      const saved = loadProjections(currentSeason, selectedWeek);
      if (saved?.rows?.length) {
        // Check if server has data for this week
        const currentServerData = queryClient.getQueryData(['/api/projections', currentSeason, selectedWeek]) as any[];
        if (!currentServerData || currentServerData.length === 0) {
          // Server is empty, auto-apply saved data
          queryClient.setQueryData(['/api/projections', currentSeason, selectedWeek], saved.rows);
          setUsingSavedMsg(`Auto-loaded saved projections (updated ${new Date(saved.updatedAt).toLocaleString()}) for Week ${selectedWeek}, ${currentSeason}.`);
        } else {
          setUsingSavedMsg(`Saved projections available (updated ${new Date(saved.updatedAt).toLocaleString()}) for Week ${selectedWeek}, ${currentSeason}.`);
        }
      } else {
        // Try to load built-in projections if no saved data
        const currentServerData = queryClient.getQueryData(['/api/projections', currentSeason, selectedWeek]) as any[];
        if (!currentServerData || currentServerData.length === 0) {
          try {
            console.log(`[AdminModal] Attempting to load built-in projections for ${currentSeason} W${selectedWeek}`);
            const got = await loadBuiltInOrSaved({
              season: currentSeason,
              week: selectedWeek,
              loadSaved: loadProjections,
              saveSaved: saveProjections,
              setProjections: (rows: any[]) => {
                console.log(`[AdminModal] Got ${rows.length} built-in projections, setting in query cache`);
                queryClient.setQueryData(['/api/projections', currentSeason, selectedWeek], rows);
              },
              setProjIdx: () => {},
              setBanner: (msg: string | null) => {
                setUsingSavedMsg(msg);
                console.log(`[AdminModal] Built-in loader message: ${msg}`);
              }
            });
            if (!got) {
              setUsingSavedMsg(null);
            }
          } catch (error) {
            console.log(`[AdminModal] Failed to load built-in projections:`, error);
            setUsingSavedMsg(null);
          }
        }
      }
    })();
  }, [currentSeason, selectedWeek, queryClient]);

  const { data: projections = [], isLoading } = useQuery<Projection[]>({
    queryKey: ['/api/projections', currentSeason, selectedWeek],
    enabled: isOpen
  });

  const bulkUploadMutation = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const parsed = await parseProjections(file);
      const response = await apiRequest('POST', '/api/projections/bulk', {
        week: selectedWeek,
        season: currentSeason,
        projections: parsed
      });
      
      // Save to localStorage for this week
      saveProjections(currentSeason, selectedWeek, parsed);
      setUsingSavedMsg(`Saved projections for Week ${selectedWeek}, ${currentSeason}.`);
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projections'] });
      toast({ title: "Success", description: "Projections uploaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to upload projections", variant: "destructive" });
    }
  });

  const addProjectionMutation = useMutation({
    mutationFn: async (projection: any) => {
      const response = await apiRequest('POST', '/api/projections', {
        ...projection,
        week: selectedWeek,
        season: currentSeason,
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
      toast({ title: "Error", description: error.message || "Failed to add projection", variant: "destructive" });
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
      toast({ title: "Error", description: error.message || "Failed to delete projection", variant: "destructive" });
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      bulkUploadMutation.mutate({ file });
    }
  };

  const handleAddProjection = () => {
    if (!newProjection.name || !newProjection.pos || !newProjection.proj) {
      toast({ title: "Error", description: "Name, position, and projection are required", variant: "destructive" });
      return;
    }
    addProjectionMutation.mutate(newProjection);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-admin">
      <div className="admin-panel card rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-primary-foreground flex items-center gap-2">
            <i className="fas fa-cog"></i>
            Admin Panel - Update Projections
          </h2>
          <button 
            className="text-primary-foreground hover:text-primary-foreground/80 text-xl"
            onClick={onClose}
            data-testid="button-close-admin"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 bg-card text-card-foreground overflow-y-auto">
          {/* Week Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Update Week</label>
            <select 
              className="w-full max-w-xs px-3 py-2 border border-input rounded-md"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              data-testid="select-week"
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map(week => (
                <option key={week} value={week.toString()}>
                  Week {week} {week.toString() === currentWeek ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Current Projections Table */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Current StatChasers Projections</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
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
                          No projections found for Week {selectedWeek}
                        </td>
                      </tr>
                    ) : (
                      projections.map((proj, index) => (
                        <tr key={proj.id} className="projection-row" data-testid={`row-projection-${index}`}>
                          <td className="px-4 py-3 font-medium">{proj.name}</td>
                          <td className="px-4 py-3">{proj.team || '-'}</td>
                          <td className="px-4 py-3">{proj.pos}</td>
                          <td className="px-4 py-3 text-right">{Number(proj.proj).toFixed(1)}</td>
                          <td className="px-4 py-3">{proj.opp || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              className="text-primary hover:text-primary/80 mr-2"
                              data-testid={`button-edit-${index}`}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              className="text-destructive hover:text-destructive/80"
                              onClick={() => deleteProjectionMutation.mutate(proj.id)}
                              data-testid={`button-delete-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bulk Update Section */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Bulk Update Projections</h3>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground mb-4">
                Drop your StatChasers CSV file here or click to browse
              </p>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                id="csvUpload"
                onChange={handleFileUpload}
                data-testid="input-csv-upload"
              />
              <button 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors"
                onClick={() => document.getElementById('csvUpload')?.click()}
                disabled={bulkUploadMutation.isPending}
                data-testid="button-select-csv"
              >
                {bulkUploadMutation.isPending ? "Uploading..." : "Select CSV File"}
              </button>
            </div>
            
            {/* Storage Management */}
            {usingSavedMsg && (
              <div className="text-xs text-emerald-700 mb-2" data-testid="text-saved-msg">{usingSavedMsg}</div>
            )}
            <div className="flex gap-2">
              <button
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                onClick={() => {
                  const saved = loadProjections(currentSeason, selectedWeek);
                  if (saved?.rows) {
                    // Actually inject saved data into React Query cache
                    queryClient.setQueryData(['/api/projections', currentSeason, selectedWeek], saved.rows);
                    setUsingSavedMsg(`Using saved projections (updated ${new Date(saved.updatedAt).toLocaleString()}).`);
                    toast({ title: "Loaded", description: `Loaded ${saved.rows.length} saved projections for Week ${selectedWeek}, ${currentSeason}` });
                  } else {
                    toast({ title: "No saved projections", description: `No saved projections found for Week ${selectedWeek}, ${currentSeason}`, variant: "destructive" });
                  }
                }}
                data-testid="button-use-saved"
              >
                Use Saved for This Week
              </button>
              <button
                className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
                onClick={() => {
                  clearProjections(currentSeason, selectedWeek);
                  setUsingSavedMsg(null);
                  toast({ title: "Cleared", description: `Cleared saved projections for Week ${selectedWeek}, ${currentSeason}` });
                }}
                data-testid="button-clear-saved"
              >
                Clear Saved for This Week
              </button>
            </div>
          </div>

          {/* Manual Add Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Player Name</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-input rounded-md text-sm" 
                placeholder="e.g., Patrick Mahomes"
                value={newProjection.name}
                onChange={(e) => setNewProjection({...newProjection, name: e.target.value})}
                data-testid="input-player-name"
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
                data-testid="input-team"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <select 
                className="w-full px-3 py-2 border border-input rounded-md text-sm"
                value={newProjection.pos}
                onChange={(e) => setNewProjection({...newProjection, pos: e.target.value})}
                data-testid="select-position"
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
              <label className="block text-sm font-medium mb-1">Projection</label>
              <input 
                type="number" 
                step="0.1" 
                className="w-full px-3 py-2 border border-input rounded-md text-sm" 
                placeholder="0.0"
                value={newProjection.proj}
                onChange={(e) => setNewProjection({...newProjection, proj: e.target.value})}
                data-testid="input-projection"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Opponent</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-input rounded-md text-sm" 
                placeholder="@DEN"
                value={newProjection.opp}
                onChange={(e) => setNewProjection({...newProjection, opp: e.target.value})}
                data-testid="input-opponent"
              />
            </div>
            <div className="flex items-end">
              <button 
                className="w-full bg-accent text-accent-foreground px-4 py-2 rounded-md font-medium hover:bg-accent/90 transition-colors text-sm flex items-center justify-center gap-1"
                onClick={handleAddProjection}
                disabled={addProjectionMutation.isPending}
                data-testid="button-add-projection"
              >
                <Plus className="w-4 h-4" />
                {addProjectionMutation.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              {projections.length > 0 && projections[0].updated_at && (
                `Last Updated: ${new Date(projections[0].updated_at).toLocaleString()}`
              )}
            </div>
            <div className="space-x-3">
              <button className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2" data-testid="button-reset">
                <RotateCcw className="w-4 h-4" />
                Reset to Defaults
              </button>
              <button className="bg-accent text-accent-foreground px-4 py-2 rounded-md font-medium hover:bg-accent/90 transition-colors flex items-center gap-2" data-testid="button-save-all">
                <Save className="w-4 h-4" />
                Save All Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
