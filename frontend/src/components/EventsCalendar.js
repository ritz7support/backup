import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { eventsAPI } from '../lib/api';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar, Clock, Users, Plus, Video, CheckCircle, Loader2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { toast } from 'sonner';

export default function EventsCalendar({ spaceId }) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
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
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await eventsAPI.getEvents();
      setEvents(response.data || []);
    } catch (error) {
      console.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await eventsAPI.updateEvent(editingEvent.id, formData);
        toast.success('Event updated!');
      } else {
        await eventsAPI.createEvent(formData);
        toast.success('Event created!');
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
      loadEvents();
    } catch (error) {
      toast.error('Failed to save event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await eventsAPI.deleteEvent(eventId);
      toast.success('Event deleted!');
      loadEvents();
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  const handleRSVP = async (eventId) => {
    try {
      await eventsAPI.rsvpEvent(eventId);
      toast.success('RSVP updated!');
      loadEvents();
    } catch (error) {
      toast.error('Failed to RSVP');
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      event_type: event.event_type,
      start_time: event.start_time,
      end_time: event.end_time,
      requires_membership: event.requires_membership || false
    });
    setCreateDialogOpen(true);
  };

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.start_time);
      return isSameDay(eventDate, date);
    });
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-semibold py-2" style={{ color: '#6B7280' }}>
            {day}
          </div>
        ))}
        {days.map(day => {
          const dayEvents = getEventsForDate(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          
          return (
            <div
              key={day.toString()}
              onClick={() => setSelectedDate(day)}
              className={`min-h-[80px] p-2 border rounded-lg cursor-pointer transition-colors ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              } ${!isCurrentMonth ? 'opacity-40' : ''}`}
              style={{ borderColor: isSelected ? '#3B82F6' : '#E5E7EB' }}
            >
              <div className={`text-sm font-medium mb-1 ${isToday(day) ? 'text-blue-600 font-bold' : ''}`}>
                {format(day, 'd')}
              </div>
              {dayEvents.slice(0, 2).map((event, idx) => (
                <div key={idx} className="text-xs p-1 mb-1 rounded truncate" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 2 && (
                <div className="text-xs" style={{ color: '#6B7280' }}>+{dayEvents.length - 2} more</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const displayedEvents = showMyEvents
    ? events.filter(e => e.attendees?.includes(user?.id))
    : selectedDate
    ? getEventsForDate(selectedDate)
    : events;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#011328' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowMyEvents(!showMyEvents)}>
            {showMyEvents ? 'All Events' : 'My Events'}
          </Button>
          {user?.role === 'admin' && (
            <Button
              onClick={() => {
                setEditingEvent(null);
                setFormData({
                  title: '',
                  description: '',
                  event_type: 'live_session',
                  start_time: '',
                  end_time: '',
                  requires_membership: false
                });
                setCreateDialogOpen(true);
              }}
              style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg p-6 border" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
            Previous
          </Button>
          <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
          <Button variant="outline" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
            Next
          </Button>
        </div>
        {renderCalendar()}
      </div>

      {/* Event List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold" style={{ color: '#011328' }}>
          {showMyEvents ? 'My Events' : selectedDate ? `Events on ${format(selectedDate, 'MMM d, yyyy')}` : 'All Events'}
        </h3>
        {displayedEvents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border" style={{ borderColor: '#E5E7EB' }}>
            <Calendar className="h-12 w-12 mx-auto mb-2" style={{ color: '#8E8E8E' }} />
            <p style={{ color: '#8E8E8E' }}>No events found</p>
          </div>
        ) : (
          displayedEvents.map(event => (
            <div key={event.id} className="bg-white rounded-lg p-4 border" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold mb-2" style={{ color: '#011328' }}>{event.title}</h4>
                  <p className="text-sm mb-3" style={{ color: '#6B7280' }}>{event.description}</p>
                  <div className="flex items-center gap-4 text-sm" style={{ color: '#6B7280' }}>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {format(parseISO(event.start_time), 'MMM d, h:mm a')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {event.attendees?.length || 0} attending
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={event.attendees?.includes(user?.id) ? 'default' : 'outline'}
                    onClick={() => handleRSVP(event.id)}
                  >
                    {event.attendees?.includes(user?.id) ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Going
                      </>
                    ) : (
                      'RSVP'
                    )}
                  </Button>
                  {user?.role === 'admin' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleEditEvent(event)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteEvent(event.id)} style={{ color: '#EF4444' }}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Start Time *</Label>
              <Input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>End Time *</Label>
              <Input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}>
                {editingEvent ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
