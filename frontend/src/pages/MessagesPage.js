import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { messagingAPI, membersAPI } from '../lib/api';
import Header from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { 
  Send, 
  Users, 
  Search, 
  Plus, 
  Settings as SettingsIcon,
  Check, 
  X,
  Loader2,
  MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [messagingPreferences, setMessagingPreferences] = useState(null);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  // Group creation form
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    member_ids: []
  });
  const [allMembers, setAllMembers] = useState([]);

  useEffect(() => {
    loadConversations();
    loadMessagingPreferences();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages();
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/messages/${user.id}`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
      
      if (data.type === 'new_message' || data.type === 'new_group_message') {
        // If message is from current conversation, add it
        if (selectedConversation) {
          if (data.type === 'new_message' && 
              (data.message.sender_id === selectedConversation.user?.id || 
               data.message.receiver_id === selectedConversation.user?.id)) {
            setMessages(prev => [...prev, data.message]);
          } else if (data.type === 'new_group_message' && 
                     data.message.group_id === selectedConversation.group?.id) {
            setMessages(prev => [...prev, data.message]);
          }
        }
        
        // Refresh conversations to update last message
        loadConversations();
        
        // Show toast notification
        const senderName = data.message.sender_name || 'Someone';
        toast.info(`New message from ${senderName}`);
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected, reconnecting in 3s...');
      setTimeout(() => connectWebSocket(), 3000);
    };
  };

  const loadConversations = async () => {
    try {
      const { data } = await messagingAPI.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessagingPreferences = async () => {
    try {
      const { data } = await messagingAPI.getMyPreferences();
      setMessagingPreferences(data);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const loadMessages = async () => {
    try {
      if (selectedConversation.type === 'direct') {
        const { data } = await messagingAPI.getDirectMessages(selectedConversation.user.id);
        setMessages(data);
      } else if (selectedConversation.type === 'group') {
        const { data } = await messagingAPI.getGroupMessages(selectedConversation.group.id);
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      if (selectedConversation.type === 'direct') {
        const { data } = await messagingAPI.sendDirectMessage(
          selectedConversation.user.id,
          newMessage
        );
        setMessages(prev => [...prev, data]);
      } else if (selectedConversation.type === 'group') {
        const { data } = await messagingAPI.sendGroupMessage(
          selectedConversation.group.id,
          newMessage
        );
        setMessages(prev => [...prev, {
          ...data,
          sender_name: user.name,
          sender_picture: user.picture
        }]);
      }
      
      setNewMessage('');
      loadConversations(); // Refresh to update last message
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(error.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleToggleMessaging = async () => {
    try {
      const newValue = !messagingPreferences?.allow_messages;
      await messagingAPI.updateMyPreferences({ allow_messages: newValue });
      setMessagingPreferences(prev => ({ ...prev, allow_messages: newValue }));
      toast.success(newValue ? 'You can now receive messages' : 'Messages disabled');
    } catch (error) {
      toast.error('Failed to update preferences');
    }
  };

  const loadAllMembers = async () => {
    try {
      const { data } = await membersAPI.getMembers();
      setAllMembers(data);
    } catch (error) {
      toast.error('Failed to load members');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupForm.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    if (groupForm.member_ids.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    try {
      await messagingAPI.createGroup(groupForm);
      toast.success('Group created successfully!');
      setShowNewGroupDialog(false);
      setGroupForm({ name: '', description: '', member_ids: [] });
      loadConversations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create group');
    }
  };

  const toggleMemberSelection = (memberId) => {
    setGroupForm(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(memberId)
        ? prev.member_ids.filter(id => id !== memberId)
        : [...prev.member_ids, memberId]
    }));
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (conv.type === 'direct') {
      return conv.user.name.toLowerCase().includes(query);
    } else {
      return conv.group.name.toLowerCase().includes(query);
    }
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F3F4F6' }}>
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations Sidebar */}
        <div className="w-80 border-r bg-white flex flex-col" style={{ borderColor: '#D1D5DB' }}>
          {/* Sidebar Header */}
          <div className="p-4 border-b" style={{ borderColor: '#D1D5DB' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold" style={{ color: '#011328' }}>Messages</h2>
              <div className="flex gap-2">
                {user?.role === 'admin' && (
                  <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          loadAllMembers();
                          setShowNewGroupDialog(true);
                        }}
                        style={{ backgroundColor: '#0462CB', color: 'white' }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create Message Group</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Group Name *</Label>
                          <Input
                            value={groupForm.name}
                            onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter group name"
                          />
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={groupForm.description}
                            onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Enter group description"
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Select Members *</Label>
                          <div className="mt-2 max-h-64 overflow-y-auto border rounded-lg p-2" style={{ borderColor: '#D1D5DB' }}>
                            {allMembers.map(member => (
                              <div
                                key={member.id}
                                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                                onClick={() => toggleMemberSelection(member.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={member.picture} />
                                    <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{member.name}</span>
                                </div>
                                {groupForm.member_ids.includes(member.id) && (
                                  <Check className="h-5 w-5" style={{ color: '#0462CB' }} />
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {groupForm.member_ids.length} member(s) selected
                          </p>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setShowNewGroupDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleCreateGroup}
                            style={{ backgroundColor: '#0462CB', color: 'white' }}
                          >
                            Create Group
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowSettingsDialog(true)}
                  title="Messaging Settings"
                >
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: '#8E8E8E' }} />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#0462CB' }} />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <MessageCircle className="h-12 w-12 mb-3" style={{ color: '#D1D5DB' }} />
                <p style={{ color: '#8E8E8E' }}>
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv, idx) => (
                <div
                  key={idx}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConversation === conv ? 'bg-blue-50' : ''
                  }`}
                  style={{ borderColor: '#E5E7EB' }}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <div className="flex items-start gap-3">
                    {conv.type === 'direct' ? (
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conv.user.picture} />
                        <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                          {conv.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E6EFFA' }}>
                        <Users className="h-5 w-5" style={{ color: '#0462CB' }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold truncate" style={{ color: '#011328' }}>
                          {conv.type === 'direct' ? conv.user.name : conv.group.name}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="text-xs font-bold px-2 py-1 rounded-full" style={{
                            backgroundColor: '#0462CB',
                            color: 'white'
                          }}>
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className="text-sm truncate" style={{ color: '#8E8E8E' }}>
                          {conv.type === 'group' && conv.last_message.sender_name && `${conv.last_message.sender_name}: `}
                          {conv.last_message.content}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Settings Dialog */}
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Messaging Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: '#D1D5DB' }}>
                <div>
                  <p className="font-medium" style={{ color: '#011328' }}>Allow others to message you</p>
                  <p className="text-sm" style={{ color: '#8E8E8E' }}>
                    {messagingPreferences?.allow_messages ? 'You can receive messages' : 'Messages are disabled'}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleToggleMessaging}
                  style={{
                    backgroundColor: messagingPreferences?.allow_messages ? '#10B981' : '#6B7280',
                    color: 'white'
                  }}
                >
                  {messagingPreferences?.allow_messages ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
                <p className="text-lg font-semibold" style={{ color: '#011328' }}>Select a conversation</p>
                <p style={{ color: '#8E8E8E' }}>Choose a conversation from the list to start messaging</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: '#D1D5DB' }}>
                {selectedConversation.type === 'direct' ? (
                  <>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedConversation.user.picture} />
                      <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                        {selectedConversation.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold" style={{ color: '#011328' }}>{selectedConversation.user.name}</p>
                      <p className="text-sm capitalize" style={{ color: '#8E8E8E' }}>{selectedConversation.user.role}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E6EFFA' }}>
                      <Users className="h-5 w-5" style={{ color: '#0462CB' }} />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: '#011328' }}>{selectedConversation.group.name}</p>
                      <p className="text-sm" style={{ color: '#8E8E8E' }}>
                        {selectedConversation.group.member_ids.length} members
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: '#F9FAFB' }}>
                {messages.map((msg) => {
                  const isOwnMessage = msg.sender_id === user.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-md ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isOwnMessage && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={msg.sender_picture} />
                            <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                              {msg.sender_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          {!isOwnMessage && selectedConversation.type === 'group' && (
                            <p className="text-xs mb-1" style={{ color: '#8E8E8E' }}>{msg.sender_name}</p>
                          )}
                          <div
                            className="rounded-lg px-4 py-2"
                            style={{
                              backgroundColor: isOwnMessage ? '#0462CB' : 'white',
                              color: isOwnMessage ? 'white' : '#011328',
                              border: isOwnMessage ? 'none' : '1px solid #E5E7EB'
                            }}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t" style={{ borderColor: '#D1D5DB' }}>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    style={{ backgroundColor: '#0462CB', color: 'white' }}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
