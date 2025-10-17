import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { spacesAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Settings, Lock, Eye, EyeOff, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSpacesPage() {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [configuring, setConfiguring] = useState(false);
  const [config, setConfig] = useState({
    visibility: 'public',
    requires_payment: false,
    description: ''
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      loadSpaces();
    }
  }, [user]);

  const loadSpaces = async () => {
    try {
      const { data } = await spacesAPI.getSpaces();
      setSpaces(data);
    } catch (error) {
      toast.error('Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureSpace = (space) => {
    setSelectedSpace(space);
    setConfig({
      visibility: space.visibility || 'public',
      requires_payment: space.requires_payment || false,
      description: space.description || ''
    });
  };

  const handleSaveConfig = async () => {
    if (!selectedSpace) return;
    
    setConfiguring(true);
    try {
      await spacesAPI.configureSpace(selectedSpace.id, config);
      toast.success('Space configured successfully!');
      setSelectedSpace(null);
      loadSpaces();
    } catch (error) {
      toast.error('Failed to configure space');
    } finally {
      setConfiguring(false);
    }
  };

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'public':
        return <Eye className="h-4 w-4" />;
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'secret':
        return <EyeOff className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
        <div className="text-center">
          <Lock className="h-12 w-12 mx-auto mb-4" style={{ color: '#8E8E8E' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: '#011328' }}>Admin Access Required</h2>
          <p style={{ color: '#8E8E8E' }}>You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#F3F4F6' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#011328' }}>Space Management</h1>
          <p style={{ color: '#8E8E8E' }}>Configure visibility, access, and settings for community spaces</p>
        </div>

        <div className="grid gap-4">
          {spaces.map((space) => (
            <div key={space.id} className="bg-white rounded-lg p-6 shadow-sm border flex items-center justify-between" style={{ borderColor: '#D1D5DB' }}>
              <div className="flex items-center gap-4">
                <div className="text-3xl">{space.icon}</div>
                <div>
                  <h3 className="font-semibold text-lg" style={{ color: '#011328' }}>{space.name}</h3>
                  <p className="text-sm" style={{ color: '#8E8E8E' }}>{space.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-sm" style={{ color: '#3B3B3B' }}>
                      {getVisibilityIcon(space.visibility)}
                      <span className="capitalize">{space.visibility || 'public'}</span>
                    </div>
                    {space.requires_payment && (
                      <div className="flex items-center gap-1 text-sm px-2 py-1 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                        <DollarSign className="h-3 w-3" />
                        Paid
                      </div>
                    )}
                    {space.auto_join && (
                      <div className="text-sm px-2 py-1 rounded" style={{ backgroundColor: '#E6EFFA', color: '#0462CB' }}>
                        Auto-join
                      </div>
                    )}
                    <div className="text-sm" style={{ color: '#8E8E8E' }}>
                      {space.member_count || 0} members
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => handleConfigureSpace(space)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={!!selectedSpace} onOpenChange={() => setSelectedSpace(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {selectedSpace?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Visibility</Label>
              <Select value={config.visibility} onValueChange={(value) => setConfig({ ...config, visibility: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Public - Everyone can see and join
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Private - Request to join
                    </div>
                  </SelectItem>
                  <SelectItem value="secret">
                    <div className="flex items-center gap-2">
                      <EyeOff className="h-4 w-4" />
                      Secret - Invite only
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs mt-1" style={{ color: '#8E8E8E' }}>
                {config.visibility === 'public' && 'Anyone can see and join this space freely'}
                {config.visibility === 'private' && 'Members can see but must request to join'}
                {config.visibility === 'secret' && 'Only invited members can see this space'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requires_payment"
                checked={config.requires_payment}
                onChange={(e) => setConfig({ ...config, requires_payment: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="requires_payment" className="cursor-pointer">
                Requires paid membership
              </Label>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="Brief description of this space..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedSpace(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveConfig}
                disabled={configuring}
                style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
              >
                {configuring ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
