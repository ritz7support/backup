import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { eventsAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar, Clock, Users, Plus, Video, CheckCircle, Loader2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { toast } from 'sonner';
import Sidebar from '../components/Sidebar';
import { spacesAPI } from '../lib/api';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Bell, MessageCircle, Settings, LogOut, Crown, Home } from 'lucide-react';

export default function EventsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [spaceGroups, setSpaceGroups] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'live_session',
    start_time: '',
    end_time: '',
    requires_membership: false
  });
  const [editingEvent, setEditingEvent] = useState(null);
  const [showMyEvents, setShowMyEvents] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsRes, groupsRes, spacesRes] = await Promise.all([
        eventsAPI.getEvents(true),
        spacesAPI.getSpaceGroups(),
        spacesAPI.getSpaces()
      ]);
      setEvents(eventsRes.data);
      setSpaceGroups(groupsRes.data);
      setSpaces(spacesRes.data);
    } catch (error) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    
    // Validate end time is after start time
    if (new Date(formData.end_time) <= new Date(formData.start_time)) {
      toast.error('End time must be after start time');
      return;
    }
    
    try {
      if (editingEvent) {
        await eventsAPI.updateEvent(editingEvent.id, {
          ...formData,
          tags: [formData.event_type]
        });
        toast.success('Event updated successfully!');
      } else {
        await eventsAPI.createEvent({
          ...formData,
          tags: [formData.event_type]
        });
        toast.success('Event created successfully!');
      }
      setCreateDialogOpen(false);
      setEditingEvent(null);
      setFormData({
        title: '',
        description: '',
        event_type: 'live_session',
        start_time: '',
        end_time: '',
        requires_membership: false
      });
      loadData();
    } catch (error) {
      toast.error(editingEvent ? 'Failed to update event' : 'Failed to create event');
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      start_time: event.start_time.slice(0, 16), // Format for datetime-local
      end_time: event.end_time.slice(0, 16),
      requires_membership: event.requires_membership
    });
    setCreateDialogOpen(true);
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await eventsAPI.deleteEvent(eventId);
        toast.success('Event deleted successfully!');
        loadData();
      } catch (error) {
        toast.error('Failed to delete event');
      }
    }
  };

  const handleRSVP = async (eventId) => {
    try {
      await eventsAPI.rsvpEvent(eventId);
      toast.success('RSVP updated!');
      loadData();
    } catch (error) {
      toast.error('Failed to RSVP');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.start_time);
      return isSameDay(eventDate, date);
    });
  };

  const upcomingEvents = showMyEvents 
    ? events.filter(event => event.rsvp_list?.includes(user?.id)).slice(0, 10)
    : events.slice(0, 10);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F3F4F6' }} data-testid="events-page">
      {/* Top Navigation */}
      <header className="border-b sticky top-0 z-50" style={{ backgroundColor: '#011328', borderColor: '#022955' }}>
        <div className="px-6 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/dashboard">
              <img 
                src="https://customer-assets.emergentagent.com/job_abcd-community/artifacts/2ftx37lf_white-blackbackground.png" 
                alt="ABCD" 
                className="h-10 w-10"
              />
            </Link>
          </div>

          <nav className="flex gap-8">
            <Link to="/dashboard" className="text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors" data-testid="nav-home">
              <Home className="h-5 w-5" />
              Home
            </Link>
            <Link to="/members" className="text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors" data-testid="nav-members">
              <Users className="h-5 w-5" />
              Members
            </Link>
            <Link to="/dms" className="text-gray-300 hover:text-white font-medium flex items-center gap-2 transition-colors" data-testid="nav-dms">
              <MessageCircle className="h-5 w-5" />
              Messages
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white" style={{ backgroundColor: 'transparent' }} data-testid="notifications-btn">
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-gray-300 hover:text-white" style={{ backgroundColor: 'transparent' }} data-testid="user-menu-trigger">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.picture} />
                    <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>{user?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  {user?.is_founding_member && (
                    <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: '#0462CB' }}>
                      <Crown className="h-3 w-3" />
                      Founding Member
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/profile/${user?.id}`)}>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/pricing')}>Upgrade Plan</DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <Sidebar spaceGroups={spaceGroups} spaces={spaces} />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold" style={{ color: '#011328' }}>Events</h1>
                <p style={{ color: '#3B3B3B' }}>Join live sessions, workshops, and community events</p>
              </div>
              {user?.role === 'admin' && (
                <Dialog open={createDialogOpen} onOpenChange={(open) => {
                  setCreateDialogOpen(open);
                  if (!open) {
                    setEditingEvent(null);
                    setFormData({
                      title: '',
                      description: '',
                      event_type: 'live_session',
                      start_time: '',
                      end_time: '',
                      requires_membership: false
                    });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }} data-testid="create-event-btn">
                      <Plus className="h-5 w-5 mr-2" />
                      Create Event
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateEvent} className="space-y-4">
                      <div>
                        <Label htmlFor="title">Event Title</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="event_type">Event Type</Label>
                        <Select value={formData.event_type} onValueChange={(value) => setFormData({ ...formData, event_type: value })}>
                          <SelectTrigger id="event_type">
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={5}>
                            <SelectItem value="live_session">Live Session</SelectItem>
                            <SelectItem value="workshop">Workshop</SelectItem>
                            <SelectItem value="q_and_a">Q&A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start_time">Start Time</Label>
                          <Input
                            id="start_time"
                            type="datetime-local"
                            value={formData.start_time}
                            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                            required
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end_time">End Time</Label>
                          <Input
                            id="end_time"
                            type="datetime-local"
                            value={formData.end_time}
                            min={formData.start_time}
                            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                            required
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="requires_membership"
                          checked={formData.requires_membership}
                          onChange={(e) => setFormData({ ...formData, requires_membership: e.target.checked })}
                        />
                        <Label htmlFor="requires_membership">Requires paid membership</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" className="flex-1" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}>
                          {editingEvent ? 'Update Event' : 'Create Event'}
                        </Button>
                        {editingEvent && (
                          <Button 
                            type="button" 
                            variant="destructive" 
                            onClick={() => {
                              setCreateDialogOpen(false);
                              handleDeleteEvent(editingEvent.id);
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Calendar View */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold" style={{ color: '#011328' }}>
                        {format(currentMonth, 'MMMM yyyy')}
                      </h2>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-sm font-semibold py-2" style={{ color: '#8E8E8E' }}>
                          {day}
                        </div>
                      ))}
                      {daysInMonth.map(day => {
                        const dayEvents = getEventsForDate(day);
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const isTodayDate = isToday(day);
                        
                        return (
                          <button
                            key={day.toString()}
                            onClick={() => setSelectedDate(day)}
                            className="p-2 rounded-lg text-sm min-h-[60px] flex flex-col items-start hover:bg-gray-50 transition-colors"
                            style={{
                              backgroundColor: isSelected ? '#E6EFFA' : isTodayDate ? '#5796DC' : 'transparent',
                              color: isTodayDate ? 'white' : '#011328',
                              border: isSelected ? '2px solid #0462CB' : '1px solid #E5E7EB'
                            }}
                          >
                            <span className="font-medium">{format(day, 'd')}</span>
                            {dayEvents.length > 0 && (
                              <div className="mt-1 w-full">
                                {dayEvents.slice(0, 2).map((event, idx) => (
                                  <div
                                    key={idx}
                                    className="text-xs truncate rounded px-1 py-0.5 mt-0.5 cursor-pointer hover:opacity-80"
                                    style={{ backgroundColor: '#FFB91A', color: '#011328' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (user?.role === 'admin') {
                                        handleEditEvent(event);
                                      }
                                    }}
                                  >
                                    {event.title}
                                  </div>
                                ))}
                                {dayEvents.length > 2 && (
                                  <div className="text-xs" style={{ color: '#8E8E8E' }}>+{dayEvents.length - 2} more</div>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Upcoming Events List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold" style={{ color: '#011328' }}>
                      {showMyEvents ? 'My Registered Events' : 'Upcoming Events'}
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMyEvents(!showMyEvents)}
                      style={showMyEvents ? { background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white', border: 'none' } : {}}
                    >
                      {showMyEvents ? 'Show All' : 'My Events'}
                    </Button>
                  </div>
                  {upcomingEvents.map(event => {
                    const isRSVPd = event.rsvp_list?.includes(user?.id);
                    const isLocked = event.requires_membership && user?.membership_tier === 'free';
                    
                    return (
                      <div key={event.id} className="bg-white rounded-xl p-4 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold" style={{ color: '#011328' }}>{event.title}</h3>
                          <div className="flex items-center gap-2">
                            {isLocked && (
                              <Crown className="h-4 w-4" style={{ color: '#FFB91A' }} />
                            )}
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => handleEditEvent(event)}
                                className="text-xs px-2 py-1 rounded hover:bg-gray-100"
                                style={{ color: '#0462CB' }}
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm mb-3" style={{ color: '#3B3B3B' }}>{event.description}</p>
                        <div className="flex items-center gap-4 text-sm mb-3" style={{ color: '#8E8E8E' }}>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(parseISO(event.start_time), 'MMM dd, yyyy')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(parseISO(event.start_time), 'h:mm a')}
                          </div>
                        </div>
                        <Button
                          onClick={() => isLocked ? navigate('/pricing') : handleRSVP(event.id)}
                          className="w-full"
                          style={{
                            background: isRSVPd ? 'linear-gradient(135deg, #027A48 0%, #027A48 100%)' : 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)',
                            color: 'white'
                          }}
                          data-testid={`rsvp-btn-${event.id}`}
                        >
                          {isLocked ? (
                            <>
                              <Crown className="h-4 w-4 mr-2" />
                              Upgrade to Join
                            </>
                          ) : isRSVPd ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Registered
                            </>
                          ) : (
                            <>
                              <Video className="h-4 w-4 mr-2" />
                              Register
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                  {upcomingEvents.length === 0 && (
                    <div className="text-center py-10">
                      <p style={{ color: '#8E8E8E' }}>
                        {showMyEvents ? 'No registered events yet' : 'No upcoming events'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
